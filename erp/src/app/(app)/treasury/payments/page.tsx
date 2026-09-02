import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty } from '@/components/ui.tsx';

const METHOD_AR: Record<string, string> = {
  CASH: 'نقداً', TRANSFER: 'تحويل بنكي', MADA: 'مدى',
  VISA: 'بطاقة ائتمان', CHEQUE: 'شيك', APPLE_PAY: 'Apple Pay', OTHER: 'أخرى',
};

export default async function PaymentsPage() {
  const session = await requireAuth('treasury.payment.read');

  const payments = await withTenant(session.tenantId, (tx) =>
    tx.payment.findMany({
      where: { tenantId: session.tenantId },
      include: {
        partner: { select: { nameAr: true } },
        bankAccount: { select: { nameAr: true } },
        _count: { select: { allocations: true } },
      },
      orderBy: [{ paymentDate: 'desc' }, { number: 'desc' }],
      take: 100,
    }),
  );

  return (
    <>
      <PageHead title="سندات القبض والصرف" sub={`آخر ${payments.length} سنداً`} />

      <div className="content">
        <Card
          hint="ما لم يُخصَّص من السند دفعةٌ مقدمة، وله في الدفتر حسابه كالتزام — لا إيراد حتى تُقدَّم الخدمة."
          flush
        >
          {payments.length === 0 ? (
            <Empty title="لا سندات" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>الرقم</th>
                    <th style={{ width: 80 }}>النوع</th>
                    <th>الطرف</th>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th style={{ width: 160 }}>الحساب / الوسيلة</th>
                    <th className="num" style={{ width: 70 }}>مخصَّص على</th>
                    <th className="num" style={{ width: 130 }}>المبلغ</th>
                    <th className="num" style={{ width: 130 }}>غير مخصَّص</th>
                    <th style={{ width: 100 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.number}</td>
                      <td>
                        <span className={`badge ${p.direction === 'IN' ? 'ok' : 'warn'}`}>
                          {p.direction === 'IN' ? 'قبض' : 'صرف'}
                        </span>
                      </td>
                      <td>{p.partner?.nameAr ?? <span className="muted">—</span>}</td>
                      <td><DateText value={p.paymentDate} /></td>
                      <td className="small">
                        {p.bankAccount.nameAr}
                        <div className="muted">{METHOD_AR[p.method] ?? p.method}</div>
                      </td>
                      <td className="num">{p._count.allocations || '—'}</td>
                      <td className="num"><Money value={p.amount} /></td>
                      <td className="num">
                        {Number(p.unallocated) > 0
                          ? <span className="badge warn"><Money value={p.unallocated} /></span>
                          : <span className="muted">—</span>}
                      </td>
                      <td><Status value={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
