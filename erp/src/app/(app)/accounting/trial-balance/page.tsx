import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { trialBalance } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Empty } from '@/components/ui.tsx';
import { DateRange } from '../date-range.tsx';
import { PrintButton } from '@/components/print-button.tsx';

export default async function TrialBalancePage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await requireAuth('accounting.report.read');
  const sp = await searchParams;

  const year = new Date().getUTCFullYear();
  const from = sp.from ? new Date(sp.from) : new Date(Date.UTC(year, 0, 1));
  const to = sp.to ? new Date(sp.to) : new Date(Date.UTC(year, 11, 31));

  const tb = await withTenant(session.tenantId, (tx) =>
    trialBalance(tx, session.tenantId, from, to),
  );

  const balanced = tb.totals.closingDebit.equals(tb.totals.closingCredit);

  return (
    <>
      <PageHead
        title="ميزان المراجعة"
        sub={`من ${from.toISOString().slice(0, 10)} إلى ${to.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <DateRange from={from} to={to} basePath="/accounting/trial-balance" />

        <Card
          title="أرصدة الحسابات"
          hint={balanced
            ? 'المدين يساوي الدائن — الميزان متزن.'
            : 'الميزان لا يتزن: الخلل في الدفتر لا في التقرير.'}
          flush
        >
          {tb.rows.length === 0 ? (
            <Empty title="لا حركة في هذه الفترة" hint="غيّر المدى أو رحّل قيوداً أولاً." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الحساب</th>
                    <th className="num">رصيد افتتاحي مدين</th>
                    <th className="num">رصيد افتتاحي دائن</th>
                    <th className="num">حركة مدينة</th>
                    <th className="num">حركة دائنة</th>
                    <th className="num">رصيد ختامي مدين</th>
                    <th className="num">رصيد ختامي دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.accountId}>
                      <td className="mono">{r.code}</td>
                      <td>
                        <a href={`/accounting/ledger/${r.accountId}?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`}>
                          {r.nameAr}
                        </a>
                      </td>
                      <td className="num"><Money value={r.openingDebit} /></td>
                      <td className="num"><Money value={r.openingCredit} /></td>
                      <td className="num"><Money value={r.periodDebit} /></td>
                      <td className="num"><Money value={r.periodCredit} /></td>
                      <td className="num"><Money value={r.closingDebit} /></td>
                      <td className="num"><Money value={r.closingCredit} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>الإجمالي</td>
                    <td className="num"><Money value={tb.totals.openingDebit} /></td>
                    <td className="num"><Money value={tb.totals.openingCredit} /></td>
                    <td className="num"><Money value={tb.totals.periodDebit} /></td>
                    <td className="num"><Money value={tb.totals.periodCredit} /></td>
                    <td className="num"><Money value={tb.totals.closingDebit} /></td>
                    <td className="num"><Money value={tb.totals.closingCredit} /></td>
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
