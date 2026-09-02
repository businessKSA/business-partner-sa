import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty } from '@/components/ui.tsx';
import { d, money } from '@/lib/money.ts';

export default async function BillsPage() {
  const session = await requireAuth('purchase.bill.read');

  const bills = await withTenant(session.tenantId, (tx) =>
    tx.vendorBill.findMany({
      where: { tenantId: session.tenantId },
      include: { partner: { select: { nameAr: true } } },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: 100,
    }),
  );

  return (
    <>
      <PageHead title="فواتير الموردين" sub={`${bills.length} فاتورة`} />

      <div className="content">
        <Card
          hint="رقم فاتورة المورّد يُحفظ كما ورد، منفصلاً عن رقمنا الداخلي — به تُتتبَّع الفاتورة لدى المورّد عند أي خلاف."
          flush
        >
          {bills.length === 0 ? (
            <Empty title="لا فواتير موردين" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>رقمنا</th>
                    <th style={{ width: 140 }}>رقم المورّد</th>
                    <th>المورّد</th>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th style={{ width: 105 }}>الاستحقاق</th>
                    <th className="num" style={{ width: 130 }}>الإجمالي</th>
                    <th className="num" style={{ width: 130 }}>المتبقّي</th>
                    <th style={{ width: 120 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => {
                    const remaining = money(d(b.total).minus(d(b.paidAmount)));
                    const overdue = b.dueDate && b.dueDate < new Date() && remaining.greaterThan(0)
                      && b.status !== 'CANCELLED';
                    return (
                      <tr key={b.id}>
                        <td className="mono">{b.number}</td>
                        <td className="mono small">{b.vendorRef ?? <span className="muted">—</span>}</td>
                        <td>{b.partner.nameAr}</td>
                        <td><DateText value={b.issueDate} /></td>
                        <td>
                          <DateText value={b.dueDate} />
                          {overdue ? <span className="badge bad" style={{ marginInlineStart: 4 }}>متأخّرة</span> : null}
                        </td>
                        <td className="num"><Money value={b.total} /></td>
                        <td className="num"><Money value={remaining} /></td>
                        <td><Status value={b.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
