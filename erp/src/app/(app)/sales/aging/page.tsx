import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { partnerAging } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Empty } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { d, money, Decimal } from '@/lib/money.ts';

export default async function AgingPage({
  searchParams,
}: { searchParams: Promise<{ asOf?: string; kind?: string }> }) {
  const session = await requireAuth('accounting.report.read');
  const sp = await searchParams;
  const asOf = sp.asOf ? new Date(sp.asOf) : new Date();
  const kind = sp.kind === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE';

  const rows = await withTenant(session.tenantId, (tx) =>
    partnerAging(tx, session.tenantId, kind, asOf),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current.plus(r.current),
      days30: acc.days30.plus(r.days30),
      days60: acc.days60.plus(r.days60),
      days90: acc.days90.plus(r.days90),
      days120Plus: acc.days120Plus.plus(r.days120Plus),
      total: acc.total.plus(r.total),
    }),
    {
      current: new Decimal(0), days30: new Decimal(0), days60: new Decimal(0),
      days90: new Decimal(0), days120Plus: new Decimal(0), total: new Decimal(0),
    },
  );

  return (
    <>
      <PageHead
        title={kind === 'RECEIVABLE' ? 'أعمار الذمم المدينة' : 'أعمار الذمم الدائنة'}
        sub={`كما في ${asOf.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <div className="page-tabs">
          <Link href="/sales/aging?kind=RECEIVABLE" className={kind === 'RECEIVABLE' ? 'active' : ''}>
            على العملاء
          </Link>
          <Link href="/sales/aging?kind=PAYABLE" className={kind === 'PAYABLE' ? 'active' : ''}>
            للموردين
          </Link>
        </div>

        <Card
          hint="تُبنى من سطور الدفتر لا من جدول الفواتير، فتدخل فيها التسويات والدفعات المقدمة — وهي التي تُنسى فيُطالَب عميلٌ سدَّد."
          flush
        >
          {rows.length === 0 ? (
            <Empty title="لا أرصدة" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>{kind === 'RECEIVABLE' ? 'العميل' : 'المورّد'}</th>
                    <th className="num">حتى ٣٠ يوماً</th>
                    <th className="num">٣١ — ٦٠</th>
                    <th className="num">٦١ — ٩٠</th>
                    <th className="num">٩١ — ١٢٠</th>
                    <th className="num">أكثر من ١٢٠</th>
                    <th className="num">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.partnerId}>
                      <td className="mono">{r.code}</td>
                      <td>{r.nameAr}</td>
                      <td className="num"><Money value={r.current} /></td>
                      <td className="num"><Money value={r.days30} /></td>
                      <td className="num"><Money value={r.days60} /></td>
                      <td className="num">
                        {r.days90.isZero() ? <Money value={r.days90} /> : (
                          <span className="neg"><Money value={r.days90} /></span>
                        )}
                      </td>
                      <td className="num">
                        {r.days120Plus.isZero() ? <Money value={r.days120Plus} /> : (
                          <span className="neg"><Money value={r.days120Plus} /></span>
                        )}
                      </td>
                      <td className="num"><Money value={r.total} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>الإجمالي</td>
                    <td className="num"><Money value={totals.current} /></td>
                    <td className="num"><Money value={totals.days30} /></td>
                    <td className="num"><Money value={totals.days60} /></td>
                    <td className="num"><Money value={totals.days90} /></td>
                    <td className="num"><Money value={totals.days120Plus} /></td>
                    <td className="num"><Money value={totals.total} /></td>
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
