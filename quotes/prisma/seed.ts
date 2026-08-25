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
    nameAr: 'الباقة الشهرية — المنشآت الصغيرة (1–4 موظفين)',
    nameEn: 'Monthly Package — Small (1–4 employees)',
    unitPrice: 2500,
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
    nameAr: 'الباقة الشهرية — الانطلاق (5–49 موظفاً)',
    nameEn: 'Monthly Package — Launch (5–49 employees)',
    unitPrice: 6000,
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
    nameAr: 'الباقة الشهرية — النمو (50–200 موظف)',
    nameEn: 'Monthly Package — Growth (50–200 employees)',
    unitPrice: 10000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 12,
  },
  {
    code: 'PKG-E',
    category: 'packages',
    nameAr: 'الباقة الشهرية — التوسّع (201–500 موظف)',
    nameEn: 'Monthly Package — Scale (201–500 employees)',
    unitPrice: 20000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    notesAr: 'الموظف الإضافي بعد 500 موظف: 300 ﷼ شهرياً.',
    notesEn: 'Each employee beyond 500: 300 SAR monthly.',
    sortOrder: 13,
  },
  {
    code: 'PKG-X',
    category: 'packages',
    nameAr: 'الباقة الشهرية — الشراكة المؤسسية (أكثر من 500 موظف)',
    nameEn: 'Monthly Package — Enterprise (501+ employees)',
    unitPrice: 0,
    openPrice: true,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'حسب الاتفاقية',
    paymentTermsEn: 'Per agreement',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 14,
  },
  {
    code: 'BP-PKG-LEGAL-BASIC',
    category: 'packages',
    nameAr: 'الباقة القانونية الأساسية — للمنشآت الصغيرة',
    nameEn: 'Basic Legal Package — Small establishments',
    descAr:
      'استشارات هاتفية غير محدودة، 4 استشارات مكتوبة سنوياً، صياغة ومراجعة 6 عقود، تمثيل قضائي حتى قضيتين عماليتين سنوياً، خصم 10% على خدمات التوثيق، ومتابعة الامتثال والالتزام على كل المنصات الحكومية مع التنبيه قبل وقوع أي مخالفة.',
    descEn:
      'Unlimited phone consultations, 4 written consultations per year, drafting and review of 6 contracts, litigation representation for up to 2 labour cases per year, 10% discount on notarisation services, and compliance monitoring across every government platform with a warning before any breach.',
    unitPrice: 8000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    notesAr: 'رسوم إضافية 400 ﷼ لكل موظف إضافي بعد 10 موظفين.',
    notesEn: 'An extra SAR 400 per additional employee beyond 10 employees.',
    sortOrder: 30,
  },
  {
    code: 'BP-PKG-LEGAL-ADV',
    category: 'packages',
    nameAr: 'الباقة القانونية المتقدمة — للمنشآت المتوسطة',
    nameEn: 'Advanced Legal Package — Medium establishments',
    descAr:
      'استشارات هاتفية غير محدودة، 8 استشارات مكتوبة سنوياً، صياغة ومراجعة 12 عقداً، خدمات ملكية فكرية، تمثيل قضائي موسّع، ومتابعة الامتثال والالتزام على كل المنصات الحكومية مع التنبيه قبل وقوع أي مخالفة.',
    descEn:
      'Unlimited phone consultations, 8 written consultations per year, drafting and review of 12 contracts, intellectual property services, extended litigation representation, and compliance monitoring across every government platform with a warning before any breach.',
    unitPrice: 15000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    notesAr: 'رسوم إضافية 600 ﷼ لكل موظف إضافي بعد 25 موظفاً.',
    notesEn: 'An extra SAR 600 per additional employee beyond 25 employees.',
    sortOrder: 31,
  },
  {
    code: 'BP-PKG-LEGAL-COMP',
    category: 'packages',
    nameAr: 'الباقة القانونية الشاملة — للمنشآت الكبيرة',
    nameEn: 'Comprehensive Legal Package — Large establishments',
    unitPrice: 30000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 32,
  },
  {
    code: 'BP-PKG-LEGAL-STRAT',
    category: 'packages',
    nameAr: 'الباقة القانونية الاستراتيجية — للمجموعات والشركات القابضة',
    nameEn: 'Strategic Legal Package — Groups and holding companies',
    unitPrice: 50000,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr: 'مقدماً في بداية كل شهر',
    paymentTermsEn: 'In advance at the beginning of each month',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
    sortOrder: 33,
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

// تطوير الأعمال — نظام تشغيل الإيرادات (6 باقات: رسوم شهرية + عمولات)
const REVENUE: S[] = [
  ['REV-START', 'البداية', 'Starter', 0, '12% من الإيراد المحصّل + 3%', '12% of collected revenue + 3%'],
  ['REV-LAUNCH', 'الانطلاق', 'Launch', 2500, '10% + 2.5%', '10% + 2.5%'],
  ['REV-GROWTH', 'النمو', 'Growth', 5000, '8% + 2%', '8% + 2%'],
  ['REV-PRO', 'الاحترافية', 'Professional', 9500, '6% + 1.5%', '6% + 1.5%'],
  ['REV-ENT', 'المنشآت الكبرى', 'Enterprise', 15000, '4% + 1%', '4% + 1%'],
  ['REV-TEAM', 'الفريق المخصص', 'Dedicated Team', 20000, '3% + 1%', '3% + 1%'],
].map((r, i) => {
  const [code, ar, en, price, comAr, comEn] = r as [string, string, string, number, string, string];
  const isFrom = code === 'REV-ENT' || code === 'REV-TEAM';
  return {
    code,
    category: 'revenue-os',
    nameAr: `تطوير الأعمال — نظام تشغيل الإيرادات — باقة ${ar}`,
    nameEn: `Business Development — Revenue Operating System — ${en} Package`,
    descAr: `رسوم شهرية${isFrom ? ' تبدأ من' : ''} ${price.toLocaleString('en-US')} ريال، وعمولات ${comAr} على الإيراد المحصّل فعلياً.`,
    descEn: `Monthly fee${isFrom ? ' starting from' : ''} SAR ${price.toLocaleString('en-US')}, with commissions of ${comEn} on revenue actually collected.`,
    unitPrice: price,
    openPrice: isFrom,
    unitAr: 'شهر',
    unitEn: 'month',
    paymentTermsAr:
      'الرسوم الشهرية مقدماً في بداية كل شهر؛ والعمولات على الإيراد المحصّل فعلياً وتُسدَّد خلال 5 أيام عمل من تاريخ التحصيل',
    paymentTermsEn:
      'Monthly fees in advance at the beginning of each month; commissions on revenue actually collected, payable within 5 working days of collection',
    deliveryAr: 'اشتراك شهري',
    deliveryEn: 'Monthly subscription',
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

/** كل بنود الكتالوج في مصفوفة واحدة — تستوردها `provision.ts` لإضافة الجديد فقط. */
export const ALL_SERVICES: S[] = [...FULL_PRICED, ...REVENUE, ...OPEN_PRICE];

/** صف قاعدة البيانات المقابل لبند الكتالوج. */
export function serviceRow(s: S) {
  return {
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
  };
}

async function main() {
  for (const s of ALL_SERVICES) {
    await prisma.service.upsert({
      where: { code: s.code },
      create: serviceRow(s),
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

// تُستورد من `provision.ts` لقراءة البيانات وحدها، فلا تُشغَّل البذرة الكاملة حينها.
if (!process.env.SEED_IMPORT_ONLY) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
