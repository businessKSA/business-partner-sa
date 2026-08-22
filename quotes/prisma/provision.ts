/**
 * تهيئة قاعدة البيانات عند النشر — تُستدعى من `vercel-build` قبل البناء.
 *
 * أربع قواعد تحكمها:
 *
 * 1) لا تُلمس قاعدة البيانات إلا في نشرة الإنتاج. نشرات المعاينة تُبنى من كل
 *    طلب مراجعة، ولو طبّقت المخطط لكان كل طلب مفتوح يعدّل قاعدة الإنتاج.
 * 2) المخطط يُطبَّق بـ `prisma db push` فتُنشأ الجداول في أول نشرة بلا أوامر يدوية.
 * 3) البذرة تعمل مرة واحدة فقط. البذرة تستخدم upsert، فبذرٌ في كل نشرة يُرجع
 *    أي تعديل يدوي على أسعار الكتالوج إلى قيمه الأصلية دون أن ينتبه أحد.
 * 4) كتالوج الموقع يُستورد في كل نشرة إنتاج، لكن استيراداً آمناً: يُنشئ
 *    الناقص ولا يكتب فوق سعر خدمة قائمة. فما يُنشر على الموقع يصير قابلاً
 *    لعرض سعر وعقد وفاتورة، دون أن يضيع تسعير يدوي.
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

  if (count === 0) {
    await prisma.$disconnect();
    console.log('الكتالوج فارغ — تُبذَر البيانات الأولية.');
    await import('./seed');
  } else {
    console.log(`الكتالوج موجود (${count} خدمة) — تُتجاوز البذرة.`);
    await prisma.$disconnect();
  }

  const client = new PrismaClient();
  try {
    const { importCatalog } = await import('./catalog-import');
    const r = await importCatalog(client);
    console.log(
      `كتالوج الموقع: ${r.total} عنصراً — أُنشئ ${r.created}، حُدّث ${r.updated} دون المساس بالأسعار.`,
    );
  } catch (e) {
    // الاستيراد إضافة لا شرط للنشر: فشله يُسجَّل ولا يُسقط البناء.
    console.error('تعذّر استيراد كتالوج الموقع:', e instanceof Error ? e.message : e);
  } finally {
    await client.$disconnect();
  }
}

main().catch((e) => {
  console.error('فشلت تهيئة قاعدة البيانات:', e instanceof Error ? e.message : e);
  process.exit(1);
});
