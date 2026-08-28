import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { generalLedger } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, DateText, Empty } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { DateRange } from '../../date-range.tsx';

export default async function LedgerPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireAuth('accounting.report.read');
  const { id } = await params;
  const sp = await searchParams;

  const year = new Date().getUTCFullYear();
  const from = sp.from ? new Date(sp.from) : new Date(Date.UTC(year, 0, 1));
  const to = sp.to ? new Date(sp.to) : new Date(Date.UTC(year, 11, 31));

  const gl = await withTenant(session.tenantId, (tx) =>
    generalLedger(tx, session.tenantId, id, from, to),
  );

  return (
    <>
      <PageHead
        title={`الأستاذ المساعد — ${gl.account.nameAr}`}
        sub={`${gl.account.code} · من ${from.toISOString().slice(0, 10)} إلى ${to.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <DateRange from={from} to={to} basePath={`/accounting/ledger/${id}`} />

        <Card title="الحركات" flush>
          {gl.movements.length === 0 ? (
            <Empty title="لا حركة في هذه الفترة" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>التاريخ</th>
                    <th style={{ width: 130 }}>القيد</th>
                    <th>البيان</th>
                    <th>الطرف</th>
                    <th className="num">مدين</th>
                    <th className="num">دائن</th>
                    <th className="num">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="row-group">
                    <td colSpan={6}>الرصيد الافتتاحي</td>
                    <td className="num"><Money value={gl.opening} colored /></td>
                  </tr>
                  {gl.movements.map((m, i) => (
                    <tr key={`${m.entryNumber}-${i}`}>
                      <td><DateText value={m.date} /></td>
                      <td className="mono small">{m.entryNumber}</td>
                      <td>{m.memoAr}</td>
                      <td className="small">{m.partnerAr ?? '—'}</td>
                      <td className="num">{m.debit.isZero() ? '' : <Money value={m.debit} />}</td>
                      <td className="num">{m.credit.isZero() ? '' : <Money value={m.credit} />}</td>
                      <td className="num"><Money value={m.balance} colored /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>الإجمالي</td>
                    <td className="num"><Money value={gl.totalDebit} /></td>
                    <td className="num"><Money value={gl.totalCredit} /></td>
                    <td className="num"><Money value={gl.closing} colored /></td>
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
