/**
 * بيانات أولية: كتالوج الخدمات + جدول الرسوم الحكومية المقدّرة.
 * التشغيل: npm run seed   (upsert — آمن للتكرار)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type S = {
  code: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descAr?: string;
  descEn?: string;
  unitPrice?: number;
  unitAr?: string;
  unitEn?: string;
  minQty?: number;
  openPrice?: boolean;
  paymentTermsAr?: string;
  paymentTermsEn?: string;
  deliveryAr?: string;
  deliveryEn?: string;
  notesAr?: string;
  notesEn?: string;
  attachGovFees?: boolean;
  govFeeGroup?: string;
  validityDays?: number;
  sortOrder?: number;
};

const FULL_PRICED: S[] = [
  {
    code: 'FI-100',
    category: 'foreign-investment',
    nameAr: 'تأسيس كيان استثمار أجنبي — شركة مملوكة \u2066100%\u2069 لمستثمر أجنبي',
    nameEn: 'Foreign Investment Setup — 100% Foreign Owned Company',
    descAr:
      'إنهاء إجراءات التأسيس كاملة: حجز الاسم التجاري، إصدار رخصة الاستثمار من وزارة الاستثمار، السجل التجاري لدى وزارة التجارة، عقد التأسيس وتوثيقه، العنوان الوطني لدى البريد السعودي، الغرفة التجارية، فتح ملف المنشأة لدى وزارة الموارد البشرية والتنمية الاجتماعية والتسجيل في المؤسسة العامة للتأمينات الاجتماعية وهيئة الزكاة والضريبة والجمارك، وتفعيل منصات قوى ومقيم ومدد، وإصدار تأشيرة وإقامة المدير العام.',
    descEn:
      'Full incorporation: trade name reservation, investment licence from the Ministry of Investment, commercial registration with the Ministry of Commerce, articles of association and notarisation, national address with Saudi Post, chamber of commerce membership, establishment file with the Ministry of Human Resources and Social Development, registration with the General Organization for Social Insurance and the Zakat, Tax and Customs Authority, activation of the Qiwa, Muqeem and Mudad platforms, and the general manager visa and residency.',
    unitPrice: 30000,
    unitAr: 'كيان',
    unitEn: 'entity',
    paymentTermsAr: 'دفعتان: 15,000 ريال عند التوقيع + 15,000 ريال عند صدور رخصة الاستثمار',
    paymentTermsEn:
      'Two instalments: SAR 15,000 on signature + SAR 15,000 upon issuance of the investment licence',
    deliveryAr: 'المرحلة الأولى 6–8 أسابيع، المرحلة الثانية 6–10 أسابيع',
    deliveryEn: 'Phase one 6–8 weeks, phase two 6–10 weeks',
    attachGovFees: true,
    govFeeGroup: 'foreign-investment',
    sortOrder: 1,
  },
  {
    code: 'QW-EST',
    category: 'hr-services',
    nameAr: 'مهمة منصة قوى وفتح ملف المنشأة لدى وزارة الموارد البشرية والتنمية الاجتماعية',
    nameEn: 'Qiwa Platform Task and Establishment File with the Ministry of Human Resources and Social Development',
    descAr:
      'فتح وتفعيل ملف المنشأة لدى وزارة الموارد البشرية والتنمية الاجتماعية، وربطه بمنصة قوى، وضبط بيانات المنشأة والنطاق ومتطلبات التوطين.',
    descEn:
      'Opening and activating the establishment file with the Ministry of Human Resources and Social Development, linking it to the Qiwa platform, and configuring establishment data, Nitaqat band and Saudisation requirements.',
    unitPrice: 70000,
    unitAr: 'منشأة',
    unitEn: 'establishment',
    paymentTermsAr: 'كامل المبلغ مقدماً',
    paymentTermsEn: 'Full amount in advance',
    deliveryAr: '3 أيام عمل',
    deliveryEn: '3 working days',
    validityDays: 15,
    sortOrder: 2,
  },
  {
    code: 'CV-10',
    category: 'recruitment',
    nameAr: 'توفير سير ذاتية لمرشحين',
    nameEn: 'Candidate CV Sourcing',
    descAr: 'ترشيح وتصفية سير ذاتية مطابقة للوصف الوظيفي المعتمد من العميل. الحد الأدنى عشر سير ذاتية.',
    descEn: 'Sourcing and screening CVs matching the job description approved by the client. Minimum ten CVs.',
    unitPrice: 100,
    unitAr: 'سيرة ذاتية',
    unitEn: 'CV',
    minQty: 10,
    paymentTermsAr: 'كامل المبلغ مقدماً',
    paymentTermsEn: 'Full amount in advance',
    deliveryAr: '7 أيام',
    deliveryEn: '7 days',
    sortOrder: 3,
  },
  {
    code: 'PKG-S',
    category: 'packages',
    nameAr: 'الباقة الشهرية — البداية',
    nameEn: 'Monthly Package — Starter',
    unitPrice: 3500,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 10,
  },
  {
    code: 'PKG-G',
    category: 'packages',
    nameAr: 'الباقة الشهرية — النمو',
    nameEn: 'Monthly Package — Growth',
    unitPrice: 7500,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 11,
  },
  {
    code: 'PKG-P',
    category: 'packages',
    nameAr: 'الباقة الشهرية — الاحترافية',
    nameEn: 'Monthly Package — Professional',
    unitPrice: 15000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 12,
  },
  {
    code: 'MA-BRK',
    category: 'ma-brokerage',
    nameAr: 'وساطة اندماج واستحواذ',
    nameEn: 'Mergers and Acquisitions Brokerage',
    descAr:
      'تمثيل العميل في صفقة اندماج أو استحواذ: إعداد الملف، الوصول للأطراف، التفاوض، ومتابعة الإغلاق.',
    descEn:
      'Representing the client in a merger or acquisition transaction: file preparation, party outreach, negotiation and closing follow-up.',
    unitPrice: 0,
    openPrice: true,
    unitAr: 'صفقة',
    unitEn: 'transaction',
    paymentTermsAr:
      'عمولة نجاح 15% من قيمة الصفقة كاملة شاملة الضمانات، تُسدَّد خلال 5 أيام عمل من إتمام الصفقة، أو حصصاً بموافقة الطرفين',
    paymentTermsEn:
      'Success fee of 15% of the full transaction value including guarantees, payable within 5 working days of closing, or in equity by mutual agreement',
    deliveryAr: 'حسب الصفقة',
    deliveryEn: 'As per the transaction',
    notesAr: 'يُدخل مبلغ العمولة يدوياً عند إنشاء العرض بناءً على قيمة الصفقة المقدّرة.',
    notesEn: 'The fee amount is entered manually when creating the quotation, based on the estimated deal value.',
    sortOrder: 20,
  },
];

// تطوير الأعمال كخدمة — Business Development as a Service.
// السلّم المعتمد من المالك 2026-08-25: عمولة نجاح واحدة على الإيراد المحصّل
// فقط، بدل عمولتَي «نجاح + إغلاق» اللتين لم يكن أحد يفرّق بينهما. والنسبة
// تشتري فريق الإغلاق: من يدفع رسوماً شهرية فقط يُغلق بنفسه، ومن يدفع عمولة
// نُغلق معه — ولهذا تصح باقة النمو بلا عمولة إطلاقاً.
// أكواد REV-* محفوظة كما هي لأن عروضاً وعقوداً صادرة تشير إليها؛ تغييرها
// ييتّم تلك المستندات. أكواد باقات الموقع (revos-*) مذكورة في الملاحظات
// ليطابق العرضُ ما اشتراه العميل من السلة.
const REVENUE: S[] = [
  ['REV-START', 'أداء فقط', 'Performance Only', 0, 18, 'revos-starter', true],
  ['REV-CONNECT-INTRO', 'Connect — أول شهر', 'Connect — First Month', 249, 12, 'revos-connect-intro', false],
  ['REV-CONNECT', 'Connect', 'Connect', 499, 12, 'revos-connect', false],
  ['REV-LAUNCH', 'Launch', 'Launch', 2500, 8, 'revos-launch', false],
  ['REV-GROWTH', 'Growth', 'Growth', 5000, 0, 'revos-growth', false],
  ['REV-PRO', 'Professional', 'Professional', 9500, 5, 'revos-professional', true],
  ['REV-ENT', 'Enterprise', 'Enterprise', 15000, 3, 'revos-enterprise', true],
  ['REV-TEAM', 'Dedicated Team', 'Dedicated Team', 20000, 2, 'revos-dedicated', true],
].map((r, i) => {
  const [code, ar, en, price, commission, siteCode, weClose] = r as
    [string, string, string, number, number, string, boolean];
  const isFrom = code === 'REV-ENT' || code === 'REV-TEAM';
  const isIntro = code === 'REV-CONNECT-INTRO';
  const feeAr = commission
    ? `عمولة نجاح ${commission}% على الإيراد المحصّل فعلياً`
    : 'بدون أي عمولة — سعر شهري ثابت';
  const feeEn = commission
    ? `success fee of ${commission}% on revenue actually collected`
    : 'no commission at all — a fixed monthly price';
  const closerAr = weClose
    ? 'يشارك الطرف الأول في الإغلاق: العروض والتفاوض ومتابعة التحصيل.'
    : 'يتولى العميل الإغلاق، ويتولى الطرف الأول التوليد والتأهيل وحجز الاجتماعات.';
  const closerEn = weClose
    ? 'The First Party participates in closing: proposals, negotiation and collection follow-up.'
    : 'The client closes; the First Party generates, qualifies and books the meetings.';
  return {
    code,
    category: 'revenue-os',
    nameAr: `تطوير الأعمال كخدمة — باقة ${ar}`,
    nameEn: `Business Development as a Service — ${en}`,
    descAr: `${isIntro ? 'سعر الشهر الأول' : 'رسوم شهرية'}${isFrom ? ' تبدأ من' : ''} ${price.toLocaleString('en-US')} ريال، و${feeAr}. ${closerAr}`,
    descEn: `${isIntro ? 'First-month price' : 'Monthly fee'}${isFrom ? ' starting from' : ''} SAR ${price.toLocaleString('en-US')}, with ${feeEn}. ${closerEn}`,
    unitPrice: price,
    openPrice: isFrom,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: isIntro
      ? 'سعر تعريفي للشهر الأول يُسدَّد مقدماً، ثم يتجدد الاشتراك بـ 499 ريال شهرياً؛ والعمولة على الإيراد المحصّل فعلياً وتُسدَّد خلال 15 يوماً من التحصيل'
      : commission
        ? 'الرسوم الشهرية مقدماً في بداية كل شهر؛ والعمولة على الإيراد المحصّل فعلياً وتُسدَّد خلال 15 يوماً من تاريخ التحصيل'
        : 'الرسوم الشهرية مقدماً في بداية كل شهر؛ ولا تستحق أي عمولة على أي إيراد',
    paymentTermsEn: isIntro
      ? 'Introductory first-month price payable in advance, renewing at SAR 499 per month; the success fee is on revenue actually collected and payable within 15 days of collection'
      : commission
        ? 'Monthly fees in advance at the beginning of each month; the success fee is on revenue actually collected and payable within 15 days of collection'
        : 'Monthly fees in advance at the beginning of each month; no commission is due on any revenue',
    deliveryAr: 'اشتراك شهري يتجدد تلقائياً حتى الإلغاء',
    deliveryEn: 'Monthly subscription renewing automatically until cancelled',
    notesAr: `كود الباقة في متجر الموقع: ${siteCode}. العمولة لا تُحتسب على عملاء الطرف الثاني القائمين قبل بدء الاشتراك، ولا على فرص لم يولّدها الطرف الأول — راجع بندَي عمولة النجاح والصفقات المشمولة في العقد.`,
    notesEn: `Website store code: ${siteCode}. The success fee does not apply to the Second Party's clients existing before the subscription began, nor to opportunities not generated by the First Party — see the success fee and covered deals clauses in the contract.`,
    sortOrder: 30 + i,
  } as S;
});

/** أقسام تُسعَّر يدوياً عند إنشاء العرض (حقل سعر مفتوح لكل بند). */
const OPEN_PRICE: S[] = [
  ['CF-GEN', 'company-formation', 'تأسيس الشركات — خدمة حسب الطلب', 'Company Formation — Bespoke Service'],
  ['PR-GEN', 'premium-residency', 'الإقامة المميزة — خدمة حسب الطلب', 'Premium Residency — Bespoke Service'],
  ['HR-GEN', 'hr-services', 'الموارد البشرية — خدمة حسب الطلب', 'Human Resources — Bespoke Service'],
  ['REC-GEN', 'recruitment', 'التوظيف والاستقدام — خدمة حسب الطلب', 'Recruitment and Manpower — Bespoke Service'],
  ['GR-GEN', 'government-relations', 'مندوب العلاقات الحكومية', 'Government Relations Representative'],
  ['AI-GEN', 'ai-automation', 'الأتمتة بالذكاء الاصطناعي — خدمة حسب الطلب', 'Artificial Intelligence Automation — Bespoke Service'],
  ['TR-GEN', 'tourism', 'السياحة — خدمة حسب الطلب', 'Tourism — Bespoke Service'],
  ['SBC-GEN', 'shared-services', 'الخدمات المشتركة — خدمة حسب الطلب', 'Shared Services — Bespoke Service'],
  ['RE-GEN', 'real-estate', 'العقارات — خدمة حسب الطلب', 'Real Estate — Bespoke Service'],
  ['GOV-GEN', 'gov-transactions', 'المعاملات الحكومية — خدمة حسب الطلب', 'Government Transactions — Bespoke Service'],
  ['SUP-GEN', 'advisory', 'الدعم والاستشارات — خدمة حسب الطلب', 'Support and Advisory — Bespoke Service'],
].map((r, i) => {
  const [code, category, nameAr, nameEn] = r as [string, string, string, string];
  return {
    code,
    category,
    nameAr,
    nameEn,
    descAr: 'يُحدَّد النطاق والسعر عند إنشاء العرض حسب متطلبات العميل.',
    descEn: 'Scope and price are set when the quotation is created, according to the client requirements.',
    unitPrice: 0,
    openPrice: true,
    unitAr: 'خدمة',
    unitEn: 'service',
    paymentTermsAr: 'يُحدَّد عند إنشاء العرض',
    paymentTermsEn: 'Set when the quotation is created',
    deliveryAr: 'يُحدَّد عند إنشاء العرض',
    deliveryEn: 'Set when the quotation is created',
    sortOrder: 50 + i,
  } as S;
});

const GOV_FEES = [
  ['حجز الاسم التجاري', 'Trade name reservation', 500, null, null],
  ['توثيق السجل التجاري وعقد التأسيس', 'Notarisation of the commercial registration and articles of association', 1825, null, null],
  ['تصديق وزارة الخارجية', 'Ministry of Foreign Affairs attestation', 30, 'لكل وثيقة', 'per document'],
  ['شهادة وزارة الاستثمار', 'Ministry of Investment certificate', 2000, null, null],
  ['رخصة الاستثمار', 'Investment licence', 10000, 'السنة الأولى، ثم 60,000 ريال سنوياً', 'first year, then SAR 60,000 annually'],
  ['الجريدة الرسمية', 'Official Gazette publication', 650, null, null],
  ['شهادة السجل التجاري', 'Commercial registration certificate', 2000, null, null],
  ['الغرفة التجارية', 'Chamber of Commerce', 2000, null, null],
  ['تأشيرة المدير العام', 'General manager visa', 2000, null, null],
  ['إقامة المدير العام', 'General manager residency', 12000, 'تقريباً سنوياً', 'approximately, annually'],
  ['رسوم البلدية', 'Municipality fees', 1200, 'تقريباً', 'approximately'],
  ['العنوان الوطني لدى البريد السعودي', 'National address with Saudi Post', 1000, null, null],
  ['تسجيل منصة مقيم', 'Muqeem platform registration', 1750, null, null],
  ['رصيد منصة مقيم', 'Muqeem platform balance', 1150, null, null],
  ['ملف المنشأة لدى وزارة الموارد البشرية والتنمية الاجتماعية', 'Establishment file with the Ministry of Human Resources and Social Development', null, 'بدون رسوم', 'no fees'],
  ['منصة قوى', 'Qiwa platform', 1200, 'تبدأ من', 'starting from'],
  ['منصة مدد', 'Mudad platform', 575, null, null],
  ['التسجيل في المؤسسة العامة للتأمينات الاجتماعية', 'Registration with the General Organization for Social Insurance', null, 'بدون رسوم', 'no fees'],
  ['التسجيل في هيئة الزكاة والضريبة والجمارك', 'Registration with the Zakat, Tax and Customs Authority', null, 'بدون رسوم', 'no fees'],
] as [string, string, number | null, string | null, string | null][];

async function main() {
  const all = [...FULL_PRICED, ...REVENUE, ...OPEN_PRICE];
  for (const s of all) {
    await prisma.service.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        category: s.category,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descAr: s.descAr ?? null,
        descEn: s.descEn ?? null,
        unitPrice: s.unitPrice ?? 0,
        unitAr: s.unitAr ?? 'خدمة',
        unitEn: s.unitEn ?? 'service',
        minQty: s.minQty ?? 1,
        openPrice: s.openPrice ?? false,
        paymentTermsAr: s.paymentTermsAr ?? '',
        paymentTermsEn: s.paymentTermsEn ?? '',
        deliveryAr: s.deliveryAr ?? '',
        deliveryEn: s.deliveryEn ?? '',
        notesAr: s.notesAr ?? null,
        notesEn: s.notesEn ?? null,
        attachGovFees: s.attachGovFees ?? false,
        govFeeGroup: s.govFeeGroup ?? null,
        validityDays: s.validityDays ?? null,
        sortOrder: s.sortOrder ?? 100,
      },
      // التحديث لا يمس السعر إن عدّله المستخدم من صفحة إدارة الكتالوج
      update: {
        category: s.category,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descAr: s.descAr ?? null,
        descEn: s.descEn ?? null,
        paymentTermsAr: s.paymentTermsAr ?? '',
        paymentTermsEn: s.paymentTermsEn ?? '',
        deliveryAr: s.deliveryAr ?? '',
        deliveryEn: s.deliveryEn ?? '',
        attachGovFees: s.attachGovFees ?? false,
        govFeeGroup: s.govFeeGroup ?? null,
        validityDays: s.validityDays ?? null,
        sortOrder: s.sortOrder ?? 100,
      },
    });
  }

  await prisma.govFee.deleteMany({ where: { group: 'foreign-investment' } });
  await prisma.govFee.createMany({
    data: GOV_FEES.map(([labelAr, labelEn, amount, noteAr, noteEn], i) => ({
      group: 'foreign-investment',
      labelAr,
      labelEn,
      amount,
      amountNoteAr: noteAr,
      amountNoteEn: noteEn,
      included: true,
      sortOrder: i,
    })).concat([
      {
        group: 'foreign-investment',
        labelAr: 'تأشيرة بلد المنشأ',
        labelEn: 'Home country visa',
        amount: null,
        amountNoteAr: 'من 5,000 إلى 10,000 ريال — غير مشمولة',
        amountNoteEn: 'SAR 5,000 to 10,000 — not included',
        included: false,
        sortOrder: 99,
      },
    ]),
  });

  const [svc, fees] = await Promise.all([prisma.service.count(), prisma.govFee.count()]);
  console.log(`الكتالوج: ${svc} خدمة — الرسوم الحكومية: ${fees} بند`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
