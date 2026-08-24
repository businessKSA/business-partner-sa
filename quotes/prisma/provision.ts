/**
 * تهيئة قاعدة البيانات عند النشر — تُستدعى من `vercel-build` قبل البناء.
 *
 * ثلاث قواعد تحكمها:
 *
 * 1) لا تُلمس قاعدة البيانات إلا في نشرة الإنتاج. نشرات المعاينة تُبنى من كل
 *    طلب مراجعة، ولو طبّقت المخطط لكان كل طلب مفتوح يعدّل قاعدة الإنتاج.
 * 2) المخطط يُطبَّق بـ `prisma db push` فتُنشأ الجداول في أول نشرة بلا أوامر يدوية.
 * 3) البذرة تعمل مرة واحدة فقط. البذرة تستخدم upsert، فبذرٌ في كل نشرة يُرجع
 *    أي تعديل يدوي على أسعار الكتالوج إلى قيمه الأصلية دون أن ينتبه أحد.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

async function main() {
  const env = process.env.VERCEL_ENV;
  if (env && env !== 'production') {
    console.log(`نشرة ${env} — لا تُمَسّ قاعدة البيانات، يُكتفى بالبناء.`);
    return;
  }

  if (!process.env.DATABASE_URL || !process.env.DIRECT_DATABASE_URL) {
    throw new Error(
      'DATABASE_URL و DIRECT_DATABASE_URL مطلوبان لتهيئة قاعدة البيانات. ' +
        'اضبطهما في متغيرات بيئة المشروع ثم أعد النشر.',
    );
  }

  console.log('تطبيق المخطط على قاعدة البيانات...');
  execSync('prisma db push --skip-generate', { stdio: 'inherit' });

  const prisma = new PrismaClient();
  const count = await prisma.service.count();
  await prisma.$disconnect();

  if (count > 0) {
    // الكتالوج مبذور من قبل. البذرة الكاملة تُرجع أي سعر عدّله المستخدم يدوياً،
    // فلا تُشغَّل — لكن البنود الجديدة تُضاف وإلا بقيت حبيسة المستودع.
    const added = await addNewServices();
    console.log(
      added
        ? `الكتالوج موجود (${count} خدمة) — أُضيف ${added} بنداً جديداً.`
        : `الكتالوج موجود (${count} خدمة) ولا بنود جديدة — تُتجاوز البذرة.`,
    );
    return;
  }

  console.log('الكتالوج فارغ — تُبذَر البيانات الأولية.');
  await import('./seed');
}

/**
 * تُضيف بنود الكتالوج التي لا وجود لها في قاعدة البيانات، ولا تمسّ الموجود منها
 * بحرف. تُستورد البذرة بـ `SEED_IMPORT_ONLY` فتُقرأ بياناتها دون أن تعمل.
 */
async function addNewServices(): Promise<number> {
  process.env.SEED_IMPORT_ONLY = '1';
  const { ALL_SERVICES, serviceRow } = await import('./seed');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.service.findMany({ select: { code: true } });
    const have = new Set(existing.map((s) => s.code));
    const missing = ALL_SERVICES.filter((s) => !have.has(s.code));
    for (const s of missing) {
      await prisma.service.create({ data: serviceRow(s) });
      console.log(`  + ${s.code} — ${s.nameAr}`);
    }
    return missing.length;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('فشلت تهيئة قاعدة البيانات:', e instanceof Error ? e.message : e);
  process.exit(1);
});
