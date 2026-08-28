/**
 * باقات الاشتراك.
 *
 * تسعيرٌ مبدئي قابل للتعديل من لوحة المنصة أو من هنا. الحدود ليست عقاباً
 * بل ما يجعل التسعير قابلاً للتفسير للعميل: يعرف على أي أساس يدفع، ومتى
 * يحتاج ترقية.
 */
import './setup-env.ts';
import { prisma, withoutTenant } from '../src/lib/db.ts';

const PLANS = [
  {
    code: 'STARTER', nameAr: 'الباقة الأساسية', nameEn: 'Starter',
    monthlyPrice: '299', yearlyPrice: '2990',
    maxUsers: 3, maxInvoices: 300,
    modules: ['ACCOUNTING', 'SALES', 'ZATCA'],
    sortOrder: 10,
  },
  {
    code: 'BUSINESS', nameAr: 'باقة الأعمال', nameEn: 'Business',
    monthlyPrice: '699', yearlyPrice: '6990',
    maxUsers: 10, maxInvoices: 2000,
    modules: ['ACCOUNTING', 'SALES', 'PURCHASE', 'TREASURY', 'INVENTORY', 'ZATCA'],
    sortOrder: 20,
  },
  {
    code: 'ENTERPRISE', nameAr: 'باقة المنشآت', nameEn: 'Enterprise',
    monthlyPrice: '1499', yearlyPrice: '14990',
    maxUsers: 50, maxInvoices: 20000,
    modules: ['ACCOUNTING', 'SALES', 'PURCHASE', 'TREASURY', 'INVENTORY', 'HR', 'PROJECTS', 'ZATCA'],
    sortOrder: 30,
  },
];

async function main() {
  await withoutTenant('بذور المنصة: الباقات — جدولٌ عالمي لا يخصّ منشأة', async (tx) => {
    for (const p of PLANS) {
      await tx.plan.upsert({
        where: { code: p.code },
        create: p,
        update: p,
      });
    }
  });
  console.log(`✓ ${PLANS.length} باقات جاهزة`);
}

main()
  .catch((e) => { console.error('✗', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
