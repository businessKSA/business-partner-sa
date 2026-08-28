import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { stockValuation, reconcileStock } from '@/lib/inventory/costing.ts';
import { generalLedger } from '@/lib/accounting/reports.ts';
import { accountByRole } from '@/lib/accounting/posting.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Empty, Kpi, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';

export default async function ValuationPage() {
  const session = await requireAuth('inventory.item.read');

  const data = await withTenant(session.tenantId, async (tx) => {
    const valuation = await stockValuation(tx, session.tenantId);
    const drift = await reconcileStock(tx, session.tenantId);
    const invAcc = await accountByRole(tx, session.tenantId, 'INVENTORY');
    const gl = await generalLedger(
      tx, session.tenantId, invAcc.id,
      new Date(Date.UTC(1970, 0, 1)), new Date(),
    );
    return { valuation, drift, ledgerBalance: gl.closing };
  });

  const matches = data.ledgerBalance.equals(data.valuation.totalValue);
  const belowReorder = data.valuation.rows.filter((r) => r.belowReorder);

  return (
    <>
      <PageHead
        title="قيمة المخزون"
        sub={`${data.valuation.rows.length} صنفاً في المستودعات`}
        actions={<PrintButton />}
      />

      <div className="content">
        {data.drift.length > 0 ? (
          <Alert kind="error" title="انحراف بين الأرصدة والحركات">
            {data.drift.length} صنفاً رصيده المحفوظ يخالف مجموع حركاته.
            هذا ما يُكتشف عادةً في الجرد السنوي بعد فوات الأوان.
          </Alert>
        ) : null}

        {!matches ? (
          <Alert kind="error" title="الأستاذ يخالف المستودع">
            حساب المخزون في الدفتر <Money value={data.ledgerBalance} /> ريالاً،
            وقيمة المستودع <Money value={data.valuation.totalValue} /> ريالاً.
            الرقمان يجب أن يتطابقا.
          </Alert>
        ) : null}

        <div className="kpis">
          <Kpi label="قيمة المخزون" value={<Money value={data.valuation.totalValue} currency="ر.س" />} />
          <Kpi
            label="حساب المخزون في الأستاذ"
            value={<Money value={data.ledgerBalance} currency="ر.س" />}
            note={matches ? 'مطابق ✓' : 'غير مطابق'}
            tone={matches ? 'good' : 'bad'}
          />
          <Kpi
            label="أصناف تحت حدّ الطلب"
            value={belowReorder.length}
            tone={belowReorder.length > 0 ? 'bad' : undefined}
          />
        </div>

        <Card
          title="الأصناف"
          hint="التكلفة بالمتوسط المرجّح — تتغيّر مع كل استلام، وقيمة كل حركة صرفٍ ثُبِّتت بمتوسط لحظتها."
          flush
        >
          {data.valuation.rows.length === 0 ? (
            <Empty title="لا مخزون" hint="سجّل استلام بضاعة لتبدأ." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>الرمز</th>
                    <th>الصنف</th>
                    <th style={{ width: 160 }}>المستودع</th>
                    <th className="num" style={{ width: 110 }}>الكمية</th>
                    <th className="num" style={{ width: 130 }}>تكلفة الوحدة</th>
                    <th className="num" style={{ width: 150 }}>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.valuation.rows.map((r, i) => (
                    <tr key={`${r.sku}-${i}`}>
                      <td className="mono">{r.sku}</td>
                      <td>
                        {r.nameAr}
                        {r.belowReorder
                          ? <span className="badge warn" style={{ marginInlineStart: 6 }}>تحت حدّ الطلب</span>
                          : null}
                      </td>
                      <td>{r.warehouseAr}</td>
                      <td className="num"><Qty value={r.qty} /></td>
                      <td className="num"><Money value={r.avgCost} /></td>
                      <td className="num"><Money value={r.value} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>إجمالي قيمة المخزون</td>
                    <td className="num"><Money value={data.valuation.totalValue} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
