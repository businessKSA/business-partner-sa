/**
 * بيانات عرض للنظام المالي — تمرّ عبر دوال النظام نفسها لا عبر إدراج مباشر،
 * فما تراه الشاشات هو ناتج المنطق الحقيقي: ترقيم، ضريبة، سلسلة تجزئة، تدقيق.
 */
import { prisma } from '../src/lib/db';
import { createExpense, createRevenue, createPayrollRun } from '../src/lib/finance';
import { createInvoice, markInvoicePaid } from '../src/lib/billing';
import { issueTaxDocument, issueCreditNote } from '../src/lib/zatca/issue';
import { publicToken } from '../src/lib/tokens';

const d = (s: string) => new Date(`${s}T09:00:00Z`);

async function main() {
  // --- عملاء ---
  const alpha = await prisma.client.create({
    data: {
      nameAr: 'عبدالله الشمري', companyAr: 'مؤسسة الأفق للمقاولات',
      crNumber: '1010234567', vatNumber: '310445566700003',
      email: 'ops@alufuq.example', phone: '966501234567', city: 'الرياض',
      portalToken: publicToken(),
    },
  });
  const beta = await prisma.client.create({
    data: {
      nameAr: 'سارة القحطاني', companyAr: 'متجر نسائم',
      email: 'sara@nasaem.example', phone: '966555667788', city: 'جدة',
      portalToken: publicToken(),
    },
  });

  // --- الموارد البشرية: موظفون على أقسام مختلفة ---
  const staff = [
    { nameAr: 'محمد العتيبي', jobTitleAr: 'أخصائي علاقات حكومية', costCenter: 'GOV_SERVICES', basicSalary: 7500, allowances: 1200, gosiEmployer: 836, gosiEmployee: 731 },
    { nameAr: 'نورة الدوسري', jobTitleAr: 'تنفيذي مبيعات', costCenter: 'SALES', basicSalary: 6000, allowances: 1000, gosiEmployer: 672, gosiEmployee: 588 },
    { nameAr: 'خالد الحربي', jobTitleAr: 'أخصائي تسويق رقمي', costCenter: 'MARKETING', basicSalary: 5500, allowances: 800, gosiEmployer: 604, gosiEmployee: 529 },
    { nameAr: 'ريم السبيعي', jobTitleAr: 'محاسبة', costCenter: 'SHARED', basicSalary: 6500, allowances: 900, gosiEmployer: 710, gosiEmployee: 621 },
  ];
  for (const e of staff) await prisma.employee.create({ data: { ...e, status: 'ACTIVE' } });

  // --- مسير رواتب الشهر: يقيّد مصروفاً لكل موظف على قسمه آلياً ---
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  await createPayrollRun(month, 'admin');

  // --- مصاريف على الأقسام ---
  const today = now.toISOString().slice(0, 10);
  const firstOfMonth = `${month}-01`;
  const expenses = [
    { date: d(firstOfMonth), costCenter: 'SHARED', category: 'RENT', vendorName: 'شركة العقارات المتحدة', vendorVat: '310111222300003', descAr: 'إيجار المكتب — العارض', amountExclVat: 8000, vatAmount: 1200 },
    { date: d(firstOfMonth), costCenter: 'MARKETING', category: 'MARKETING_ADS', vendorName: 'Meta Platforms', vendorVat: '311222333400003', descAr: 'حملات إعلانية — إنستجرام وفيسبوك', amountExclVat: 4500, vatAmount: 675 },
    { date: d(today), costCenter: 'SHARED', category: 'SUBSCRIPTIONS', vendorName: 'شركة الاتصالات السعودية', vendorVat: '310999888700003', descAr: 'إنترنت واتصالات — اشتراك شهري', amountExclVat: 1200, vatAmount: 180 },
    { date: d(today), costCenter: 'GOV_SERVICES', category: 'GOV_FEES', vendorName: 'وزارة الموارد البشرية', descAr: 'رسوم إصدار رخص عمل — 4 عمال', amountExclVat: 2400, vatAmount: 0 },
    { date: d(today), costCenter: 'PURCHASES', category: 'SUPPLIES', vendorName: 'مكتبة جرير', vendorVat: '300123456700003', descAr: 'أجهزة ومستلزمات مكتبية', amountExclVat: 3200, vatAmount: 480 },
    { date: d(today), costCenter: 'SHARED', category: 'PROFESSIONAL', vendorName: 'مكتب الرشيد للمحاسبة', vendorVat: '310777666500003', descAr: 'أتعاب مراجعة وإقرار ضريبي', amountExclVat: 2500, vatAmount: 375 },
    { date: d(today), costCenter: 'SHARED', category: 'BANK_FEES', vendorName: 'مصرف الراجحي', descAr: 'عمولات تحويل ورسوم بوابة سداد', amountExclVat: 320, vatAmount: 48 },
  ];
  for (const e of expenses) await createExpense({ ...e, method: 'TRANSFER', actor: 'admin' });

  // --- فواتير عملاء: تُسدَّد فتصدر فاتورتها الضريبية داخلياً آلياً ---
  const inv1 = await createInvoice({
    clientId: alpha.id, titleAr: 'إدارة منصة قوى — اشتراك شهري (الباقة الأساسية)',
    titleEn: 'Qiwa platform management — monthly', amountExclVat: 999,
  }, 'admin');
  await markInvoicePaid(inv1.id, { provider: 'mock', method: 'transfer', ref: 'DEMO-1' });

  const inv2 = await createInvoice({
    clientId: beta.id, titleAr: 'تأسيس سجل تجاري وربط المنصات الحكومية',
    titleEn: 'CR incorporation and platform onboarding', amountExclVat: 3500,
  }, 'admin');
  await markInvoicePaid(inv2.id, { provider: 'mock', method: 'mada', ref: 'DEMO-2' });

  const inv3 = await createInvoice({
    clientId: alpha.id, titleAr: 'إضافة مدد — معالجة مخالفات حماية الأجور',
    titleEn: 'Mudad add-on — wage protection', amountExclVat: 199,
  }, 'admin');
  await markInvoicePaid(inv3.id, { provider: 'mock', method: 'transfer', ref: 'DEMO-3' });

  // فاتورة مستحقة لم تُسدَّد بعد
  await createInvoice({
    clientId: beta.id, titleAr: 'تجديد اشتراك سنوي — إدارة المنصات',
    titleEn: 'Annual renewal', amountExclVat: 11988,
    dueDate: new Date(Date.now() + 12 * 864e5),
  }, 'admin');

  // عهدة رسوم حكومية — ليست إيراداً ولا فاتورة ضريبية لها
  const custody = await createInvoice({
    clientId: alpha.id, titleAr: 'عهدة رسوم حكومية — تأشيرات ونقل كفالات',
    titleEn: 'Government fees custody', amountExclVat: 15000,
    isGovFeeDeposit: true, depositKind: 'GOV_FEE',
  }, 'admin');
  await markInvoicePaid(custody.id, { provider: 'mock', method: 'transfer', ref: 'DEMO-CUSTODY' });

  // --- فاتورة نقدية مبسطة بلا عميل مسجَّل ---
  await issueTaxDocument({
    lines: [{ nameAr: 'استشارة تأسيس — جلسة واحدة', quantity: 1, unitPrice: 750, vatPercent: 15 }],
    paymentMeansCode: '48', actor: 'admin',
  });

  // --- إشعار دائن جزئي على إحدى الفواتير ---
  const rec = await prisma.zatcaRecord.findFirst({
    where: { typeCode: '388', invoiceId: inv2.id },
  });
  if (rec) {
    await issueCreditNote({
      recordId: rec.id, amountExclVat: 500,
      reason: 'خصم بعد البيع — تأخر في تسليم أحد المخرجات', actor: 'admin',
    });
  }

  // --- إيراد يدوي خارج الفواتير ---
  await createRevenue({
    date: d(today), costCenter: 'SALES', source: 'تحصيل نقدي بالمكتب',
    descAr: 'خدمة تعقيب مستعجلة — عميل مباشر',
    amountExclVat: 600, vatAmount: 90, method: 'CASH', actor: 'admin',
  });

  const counts = {
    عملاء: await prisma.client.count(),
    موظفون: await prisma.employee.count(),
    مصاريف: await prisma.expense.count(),
    فواتير: await prisma.invoice.count(),
    'مستندات ضريبية': await prisma.zatcaRecord.count(),
  };
  console.log('تمت التهيئة:', counts);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
