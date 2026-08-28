/**
 * فحص سلامة الدفاتر.
 *
 * يُشغَّل مجدولاً وقبل إقفال السنة وبعد أي ترحيل جماعي. يجيب عن أربعة أسئلة
 * لا يجيب عنها أي تقرير مالي لأنها أسئلةٌ عن التقارير نفسها:
 * هل يتوازن المركز المالي؟ وهل كل قيد متزن في سطوره؟ وهل أرصدة المخزون
 * تطابق حركاته؟ وهل ثمّة حساب خصومٍ برصيد مدين (وهو دائماً علامةُ خطأ في
 * الترتيب: صرفٌ سبق استحقاقه، أو تسويةٌ على الجانب الخطأ)؟
 */
import '../prisma/setup-env.ts';
import { prisma, withTenant, withoutTenant } from '../src/lib/db.ts';
import { balanceSheet, trialBalance } from '../src/lib/accounting/reports.ts';
import { auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { reconcileStock } from '../src/lib/inventory/costing.ts';

async function main() {
  const t = await withoutTenant('فحص', (tx) => tx.tenant.findFirstOrThrow({ where: { slug: 'business-partner' } }));
  const now = new Date();
  const y0 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  await withTenant(t.id, async (tx) => {
    const bs = await balanceSheet(tx, t.id, now, y0);
    const tb = await trialBalance(tx, t.id, y0, now);
    console.log('التوازن           :', bs.balanced ? 'متوازن ✓' : `فرق ${bs.difference}`);
    console.log('ميزان المراجعة    :', tb.totals.closingDebit.toFixed(2), '=', tb.totals.closingCredit.toFixed(2));
    console.log('قيود مختلّة       :', (await auditLedgerIntegrity(tx, t.id)).length);
    console.log('انحراف المخزون    :', (await reconcileStock(tx, t.id)).length);
    const neg = await tx.$queryRaw<{code:string;nameAr:string;bal:string}[]>`
      SELECT a."code", a."nameAr", (COALESCE(SUM(l."credit"),0)-COALESCE(SUM(l."debit"),0))::text AS bal
      FROM "Account" a JOIN "JournalLine" l ON l."accountId"=a."id"
      JOIN "JournalEntry" e ON e."id"=l."entryId"
      WHERE a."tenantId"=${t.id} AND a."type"='LIABILITY' AND e."status"='POSTED'
      GROUP BY a."id",a."code",a."nameAr"
      HAVING (COALESCE(SUM(l."credit"),0)-COALESCE(SUM(l."debit"),0)) < 0`;
    console.log('خصوم برصيد مدين   :', neg.length ? neg : 'لا شيء ✓');
    const counts = await Promise.all([
      tx.salesInvoice.count(), tx.journalEntry.count(), tx.payment.count(),
      tx.payslip.count(), tx.partner.count(), tx.stockMove.count(),
    ]);
    console.log('\nالأحجام: فواتير', counts[0], '· قيود', counts[1], '· سندات', counts[2],
      '· قسائم', counts[3], '· أطراف', counts[4], '· حركات مخزون', counts[5]);
  });
}

main()
  .catch((e) => { console.error('✗ فشل الفحص:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
