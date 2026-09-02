import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { balanceSheet } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';

export default async function BalanceSheetPage({
  searchParams,
}: { searchParams: Promise<{ asOf?: string }> }) {
  const session = await requireAuth('accounting.report.read');
  const sp = await searchParams;
  const asOf = sp.asOf ? new Date(sp.asOf) : new Date();
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));

  const bs = await withTenant(session.tenantId, (tx) =>
    balanceSheet(tx, session.tenantId, asOf, yearStart),
  );

  return (
    <>
      <PageHead
        title="قائمة المركز المالي"
        sub={`كما في ${asOf.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <form method="get" className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="asOf">كما في تاريخ</label>
              <input id="asOf" name="asOf" type="date" defaultValue={asOf.toISOString().slice(0, 10)} />
            </div>
            <button className="btn primary" type="submit">عرض</button>
          </div>
        </form>

        {!bs.balanced ? (
          <Alert kind="error" title="القائمة لا تتوازن">
            الأصول تخالف الخصوم وحقوق الملكية بفارق <Money value={bs.difference} /> ريالاً.
            الخلل في الدفتر لا في التقرير — راجِع سلامة القيود.
          </Alert>
        ) : null}

        <div className="grid-2">
          <Card title="الأصول" flush>
            <div className="table-wrap">
              <table>
                <tbody>
                  {bs.assets.map((a) => (
                    <tr key={a.code}>
                      <td className="mono" style={{ width: 80 }}>{a.code}</td>
                      <td>{a.nameAr}</td>
                      <td className="num"><Money value={a.amount} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>إجمالي الأصول</td>
                    <td className="num"><Money value={bs.totalAssets} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div>
            <Card title="الخصوم" flush>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {bs.liabilities.map((a) => (
                      <tr key={a.code}>
                        <td className="mono" style={{ width: 80 }}>{a.code}</td>
                        <td>{a.nameAr}</td>
                        <td className="num"><Money value={a.amount} /></td>
                      </tr>
                    ))}
                    {bs.liabilities.length === 0 ? (
                      <tr><td colSpan={3} className="muted small">لا خصوم</td></tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>إجمالي الخصوم</td>
                      <td className="num"><Money value={bs.totalLiabilities} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card title="حقوق الملكية" flush>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {bs.equity.map((a) => (
                      <tr key={a.code}>
                        <td className="mono" style={{ width: 80 }}>{a.code}</td>
                        <td>{a.nameAr}</td>
                        <td className="num"><Money value={a.amount} /></td>
                      </tr>
                    ))}
                    <tr>
                      <td className="mono">—</td>
                      <td>
                        أرباح العام الجاري
                        <div className="muted small">
                          تُضاف حتى تُقفل السنة، وإلا لم تتوازن القائمة.
                        </div>
                      </td>
                      <td className="num"><Money value={bs.currentYearProfit} /></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>إجمالي حقوق الملكية</td>
                      <td className="num"><Money value={bs.totalEquity} /></td>
                    </tr>
                    <tr>
                      <td colSpan={2}>الخصوم وحقوق الملكية</td>
                      <td className="num">
                        <Money value={bs.totalLiabilities.plus(bs.totalEquity)} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
