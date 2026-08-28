import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Empty } from '@/components/ui.tsx';

const KIND_AR: Record<string, { ar: string; cls: string }> = {
  STOCK: { ar: 'مخزني', cls: 'info' },
  SERVICE: { ar: 'خدمة', cls: 'ok' },
  CONSUMABLE: { ar: 'مستهلك', cls: 'mute' },
};

export default async function ItemsPage() {
  const session = await requireAuth('inventory.item.read');

  const items = await withTenant(session.tenantId, (tx) =>
    tx.item.findMany({
      where: { tenantId: session.tenantId },
      include: { category: { select: { nameAr: true } }, taxCode: { select: { code: true } } },
      orderBy: { sku: 'asc' },
    }),
  );

  return (
    <>
      <PageHead title="الأصناف والخدمات" sub={`${items.length} صنفاً`} />

      <div className="content">
        <Card
          hint="الصنف المخزني يُتابَع رصيده ويُحمَّل على حساب المخزون؛ والخدمة تُحمَّل على المصروف مباشرةً ولا رصيد لها."
          flush
        >
          {items.length === 0 ? (
            <Empty title="لا أصناف" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>الرمز</th>
                    <th>الاسم</th>
                    <th style={{ width: 90 }}>النوع</th>
                    <th style={{ width: 80 }}>الوحدة</th>
                    <th className="num" style={{ width: 120 }}>سعر البيع</th>
                    <th className="num" style={{ width: 120 }}>تكلفة المتوسط</th>
                    <th className="num" style={{ width: 100 }}>الرصيد</th>
                    <th style={{ width: 80 }}>الضريبة</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const kind = KIND_AR[it.kind];
                    const low = it.kind === 'STOCK' && Number(it.onHand) < Number(it.reorderPoint);
                    return (
                      <tr key={it.id}>
                        <td className="mono">{it.sku}</td>
                        <td>
                          {it.nameAr}
                          {it.category ? <div className="muted small">{it.category.nameAr}</div> : null}
                        </td>
                        <td><span className={`badge ${kind.cls}`}>{kind.ar}</span></td>
                        <td className="mono small">{it.uomCode}</td>
                        <td className="num"><Money value={it.salesPrice} /></td>
                        <td className="num">
                          {it.kind === 'STOCK' ? <Money value={it.avgCost} /> : <span className="muted">—</span>}
                        </td>
                        <td className="num">
                          {it.kind === 'STOCK' ? (
                            <>
                              <Qty value={it.onHand} />
                              {low ? <div className="badge warn">تحت الحدّ</div> : null}
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="mono small">{it.taxCode?.code ?? '—'}</td>
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
