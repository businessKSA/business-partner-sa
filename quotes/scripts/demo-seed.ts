/** بيانات تجريبية لسيناريو القبول: عميل جديد + عرض بخدمتين. */
import { PrismaClient } from '@prisma/client';
import { createClient } from '../src/lib/clients';
import { createQuote } from '../src/lib/documents';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo.client@example.com';
  const existing = await prisma.client.findFirst({ where: { email } });
  if (existing) {
    await prisma.client.delete({ where: { id: existing.id } });
  }

  const client = await createClient({
    nameAr: 'أحمد عبدالله السالم',
    nameEn: 'Ahmed Abdullah Al Salem',
    companyAr: 'شركة الأفق الأزرق للتجارة',
    companyEn: 'Blue Horizon Trading Company',
    crNumber: '1010999888',
    email,
    phone: '0555123456',
    country: 'SA',
    city: 'الرياض',
    addressAr: 'حي العليا، طريق الملك فهد، الرياض',
    addressEn: 'Al Olaya District, King Fahd Road, Riyadh',
    repName: 'أحمد السالم',
    repTitle: 'المدير التنفيذي',
  });

  const fi = await prisma.service.findUniqueOrThrow({ where: { code: 'FI-100' } });
  const cv = await prisma.service.findUniqueOrThrow({ where: { code: 'CV-10' } });

  const quote = await createQuote({
    clientId: client.id,
    titleAr: 'عرض سعر — تأسيس كيان استثمار أجنبي وتوفير سير ذاتية',
    titleEn: 'Quotation — Foreign Investment Setup and Candidate CV Sourcing',
    introAr:
      'يسر شركة بزنس بارتنر سلوشنز أن تقدم لكم عرض السعر التالي لتأسيس كيان استثمار أجنبي مملوك بالكامل لمستثمر أجنبي، إضافة إلى خدمة توفير السير الذاتية للمرشحين وفق الوصف الوظيفي المعتمد من طرفكم.',
    introEn:
      'Business Partner Solutions Company is pleased to submit the following quotation for the incorporation of a fully foreign owned investment entity, in addition to candidate CV sourcing in accordance with the job description approved by you.',
    items: [
      { serviceId: fi.id, nameAr: fi.nameAr, nameEn: fi.nameEn, qty: 1, unitPrice: fi.unitPrice },
      { serviceId: cv.id, nameAr: cv.nameAr, nameEn: cv.nameEn, qty: 10, unitPrice: cv.unitPrice },
    ],
  });

  console.log(JSON.stringify({ clientId: client.id, quoteId: quote.id, number: quote.number, token: quote.publicToken, subtotal: quote.subtotal, vat: quote.vatAmount, total: quote.total }, null, 2));
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
