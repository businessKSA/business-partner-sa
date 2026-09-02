import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, DateText, Empty } from '@/components/ui.tsx';

const REASON_AR: Record<string, string> = {
  PURCHASE: 'استلام شراء', SALE: 'صرف بيع', ADJUSTMENT: 'تسوية جرد',
  TRANSFER_IN: 'تحويل وارد', TRANSFER_OUT: 'تحويل صادر',
  OPENING: 'رصيد افتتاحي', RETURN: 'مرتجع',
};

export default async function MovesPage() {
  const session = await requireAuth('inventory.move.read');

  const moves = await withTenant(session.tenantId, (tx) =>
    tx.stockMove.findMany({
      where: { tenantId: session.tenantId },
      include: {
        item: { select: { sku: true, nameAr: true } },
        warehouse: { select: { nameAr: true } },
      },
      orderBy: [{ moveDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
  );

  return (
    <>
      <PageHead title="حركات المخزون" sub={`آخر ${moves.length} حركة`} />

      <div className="content">
        <Card
          hint="الكمية موجبة للوارد وسالبة للصادر، والقيمة مُثبَّتة بتكلفة لحظة الحركة لا بالمتوسط الحالي."
          flush
        >
          {moves.length === 0 ? (
            <Empty title="لا حركات" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th style={{ width: 110 }}>الرمز</th>
                    <th>الصنف</th>
                    <th style={{ width: 150 }}>المستودع</th>
                    <th style={{ width: 130 }}>السبب</th>
                    <th className="num" style={{ width: 100 }}>الكمية</th>
                    <th className="num" style={{ width: 120 }}>تكلفة الوحدة</th>
                    <th className="num" style={{ width: 130 }}>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => {
                    const inbound = Number(m.qty) > 0;
                    return (
                      <tr key={m.id}>
                        <td><DateText value={m.moveDate} /></td>
                        <td className="mono small">{m.item.sku}</td>
                        <td>{m.item.nameAr}</td>
                        <td>{m.warehouse.nameAr}</td>
                        <td className="small">
                          <span className={`badge ${inbound ? 'ok' : 'warn'}`}>
                            {REASON_AR[m.reason] ?? m.reason}
                          </span>
                        </td>
                        <td className="num">
                          <span className={inbound ? 'pos' : 'neg'}><Qty value={m.qty} /></span>
                        </td>
                        <td className="num"><Money value={m.unitCost} /></td>
                        <td className="num"><Money value={m.value} colored /></td>
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
