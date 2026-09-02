import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty } from '@/components/ui.tsx';

const SOURCE_AR: Record<string, string> = {
  MANUAL: 'يدوي',
  SALES_INVOICE: 'فاتورة مبيعات',
  VENDOR_BILL: 'فاتورة مورّد',
  PAYMENT: 'سند',
  STOCK_MOVE: 'تكلفة مخزون',
  GOODS_RECEIPT: 'استلام بضاعة',
  PAYROLL: 'رواتب',
  ADJUSTMENT: 'تسوية',
  OPENING: 'افتتاحي',
  CLOSING: 'إقفال',
};

export default async function JournalPage({
  searchParams,
}: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireAuth('accounting.journal.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 50;

  const { entries, total } = await withTenant(session.tenantId, async (tx) => {
    const [entries, total] = await Promise.all([
      tx.journalEntry.findMany({
        where: { tenantId: session.tenantId },
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: { _count: { select: { lines: true } } },
      }),
      tx.journalEntry.count({ where: { tenantId: session.tenantId } }),
    ]);
    return { entries, total };
  });

  const pages = Math.ceil(total / perPage);

  return (
    <>
      <PageHead
        title="قيود اليومية"
        sub={`${total} قيداً`}
        actions={<Link className="btn primary" href="/accounting/journal/new">قيد جديد</Link>}
      />

      <div className="content">
        <Card
          title="القيود"
          hint="القيد المرحَّل لا يُعدَّل ولا يُحذف — يُصحَّح بقيدٍ عاكس يبقى أثره ظاهراً."
          flush
        >
          {entries.length === 0 ? (
            <Empty
              title="لا قيود بعد"
              hint="ابدأ بقيد افتتاحي أو أصدِر أول فاتورة."
              action={<Link className="btn primary" href="/accounting/journal/new">قيد جديد</Link>}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>الرقم</th>
                    <th style={{ width: 110 }}>التاريخ</th>
                    <th>البيان</th>
                    <th style={{ width: 130 }}>المصدر</th>
                    <th style={{ width: 60 }} className="num">سطور</th>
                    <th className="num" style={{ width: 140 }}>المبلغ</th>
                    <th style={{ width: 100 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/accounting/journal/${e.id}`} className="mono">{e.number}</Link>
                      </td>
                      <td><DateText value={e.date} /></td>
                      <td>{e.memoAr ?? <span className="muted">—</span>}</td>
                      <td className="small">{SOURCE_AR[e.sourceType] ?? e.sourceType}</td>
                      <td className="num">{e._count.lines}</td>
                      <td className="num"><Money value={e.totalDebit} /></td>
                      <td><Status value={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pages > 1 ? (
          <div className="actions" style={{ justifyContent: 'center' }}>
            {page > 1 ? <Link className="btn sm" href={`/accounting/journal?page=${page - 1}`}>السابق</Link> : null}
            <span className="muted small">صفحة {page} من {pages}</span>
            {page < pages ? <Link className="btn sm" href={`/accounting/journal?page=${page + 1}`}>التالي</Link> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
