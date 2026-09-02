import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { profitAndLoss } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Pct, Kpi } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { DateRange } from '../date-range.tsx';

export default async function PnlPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await requireAuth('accounting.report.read');
  const sp = await searchParams;
  const year = new Date().getUTCFullYear();
  const from = sp.from ? new Date(sp.from) : new Date(Date.UTC(year, 0, 1));
  const to = sp.to ? new Date(sp.to) : new Date();

  const pnl = await withTenant(session.tenantId, (tx) =>
    profitAndLoss(tx, session.tenantId, from, to),
  );

  const [revenue, cost, opex] = pnl.sections;

  return (
    <>
      <PageHead
        title="قائمة الدخل"
        sub={`${from.toISOString().slice(0, 10)} — ${to.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <DateRange from={from} to={to} basePath="/accounting/pnl" />

        <div className="kpis">
          <Kpi label="الإيرادات" value={<Money value={revenue.total} currency="ر.س" />} />
          <Kpi
            label="مجمل الربح"
            value={<Money value={pnl.grossProfit} currency="ر.س" />}
            note={pnl.grossMargin ? `هامش ${pnl.grossMargin.toFixed(1)}٪` : undefined}
            tone={pnl.grossProfit.isNegative() ? 'bad' : 'good'}
          />
          <Kpi label="المصروفات التشغيلية" value={<Money value={opex.total} currency="ر.س" />} />
          <Kpi
            label="صافي الربح"
            value={<Money value={pnl.netProfit} currency="ر.س" />}
            note={pnl.netMargin ? `هامش ${pnl.netMargin.toFixed(1)}٪` : undefined}
            tone={pnl.netProfit.isNegative() ? 'bad' : 'good'}
          />
        </div>

        <Card title="التفصيل" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>الرمز</th>
                  <th>البند</th>
                  <th className="num" style={{ width: 180 }}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <Section section={revenue} />
                <Section section={cost} />
                <tr className="row-group">
                  <td colSpan={2}>مجمل الربح</td>
                  <td className="num"><Money value={pnl.grossProfit} /></td>
                </tr>
                <Section section={opex} />
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>صافي الربح (الخسارة)</td>
                  <td className="num">
                    <span className={pnl.netProfit.isNegative() ? 'neg' : 'pos'}>
                      <Money value={pnl.netProfit} />
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <p className="muted small">
          مجمل الربح هو الإيراد ناقصاً تكلفته المباشرة — وهو الرقم الذي يقول إن كان
          التسعير سليماً قبل أن تُحمَّل عليه مصروفات الإدارة.
        </p>
      </div>
    </>
  );
}

function Section({ section }: { section: { labelAr: string; accounts: { code: string; nameAr: string; amount: import('@/lib/money.ts').Decimal }[]; total: import('@/lib/money.ts').Decimal } }) {
  return (
    <>
      <tr className="row-group">
        <td colSpan={2}>{section.labelAr}</td>
        <td className="num"><Money value={section.total} /></td>
      </tr>
      {section.accounts.map((a) => (
        <tr key={a.code}>
          <td className="mono">{a.code}</td>
          <td className="tree-indent-1">{a.nameAr}</td>
          <td className="num"><Money value={a.amount} /></td>
        </tr>
      ))}
      {section.accounts.length === 0 ? (
        <tr>
          <td colSpan={3} className="muted small tree-indent-1">لا حركة</td>
        </tr>
      ) : null}
    </>
  );
}
