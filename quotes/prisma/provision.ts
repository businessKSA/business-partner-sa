/**
 * تهيئة قاعدة البيانات عند النشر.
 *
 * تُبذَر البيانات الأولية مرة واحدة فقط: لو أعدنا البذر في كل نشرة لأعادت
 * أي تعديل يدوي على أسعار الكتالوج إلى قيمها الأصلية. فنتحقق أولاً، ونتجاوز
 * البذرة إن كان الكتالوج موجوداً.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.service.count();
  await prisma.$disconnect();

  if (count > 0) {
    console.log(`الكتالوج موجود (${count} خدمة) — تُتجاوز البذرة.`);
    return;
  }

  console.log('قاعدة فارغة — تُبذَر البيانات الأولية.');
  await import('./seed');
}

main().catch(async (e) => {
  console.error('فشلت تهيئة قاعدة البيانات:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
