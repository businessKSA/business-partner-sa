import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Money, Kpi, Alert } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { previewClosing, openingBalances } from '@/lib/accounting/closing.ts';
import type { Decimal } from '@/lib/money.ts';
import { CloseYearForm, UndoClosing } from './closing-actions.tsx';

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await requireAuth('accounting.report.read');
  const canClose = can(session.permissions, 'accounting.closing.run');
  const canUndo = can(session.permissions, 'accounting.closing.reverse');
  const { year: selected } = await searchParams;

  const data = await withTenant(session.tenantId, async (tx) => {
    const years = await tx.fiscalYear.findMany({
      where: { tenantId: session.tenantId },
      include: { closing: true },
      orderBy: { startDate: 'desc' },
    });
    if (!years.length) return { years, fy: null, preview: null, opening: null };

    const fy = years.find((y) => y.id === selected) ?? years[0];
    return {
      years,
      fy,
      preview: await previewClosing(tx, session.tenantId, fy.id),
      opening: await openingBalances(tx, session.tenantId, fy.id),
    };
  });

  if (!data.fy || !data.preview) {
    return (
      <>
        <PageHead title="الإقفال السنوي" />
        <div className="content">
          <Card><Empty title="لا سنوات مالية" hint="أنشئ سنةً من شاشة الفترات المالية." /></Card>
        </div>
      </>
    );
  }

  const { fy, preview, opening, years } = data;
  const closing = fy.closing;
  const closed = closing?.status === 'POSTED';
  const profit = preview.netProfit.greaterThanOrEqualTo(0);

  return (
    <>
      <PageHead
        title="الإقفال السنوي"
        sub="القيد الذي ينقل ربح السنة إلى الأرباح المُبقاة ويعيد الحسابات المؤقّتة إلى الصفر."
        actions={
          <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select name="year" defaultValue={fy.id} style={{ minWidth: 140 }}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
            <button className="btn sm" type="submit">عرض</button>
          </form>
        }
      />

      <div className="content">
        <div className="kpis">
          <Kpi label="إجمالي الإيرادات" value={<Money value={preview.totalRevenue} />} />
          <Kpi label="إجمالي المصروفات" value={<Money value={preview.totalExpense} />} />
          <Kpi
            label={profit ? 'صافي الربح' : 'صافي الخسارة'}
            value={<Money value={preview.netProfit} colored />}
            tone={profit ? 'good' : 'bad'}
            note="ينتقل إلى الأرباح المُبقاة"
          />
          <Kpi label="حسابات تُقفَل" value={preview.accountsToClose} />
        </div>

        {preview.draftEntries > 0 ? (
          <Alert kind="error" title="قيود مسوّدة تمنع الإقفال">
            في السنة {preview.draftEntries} قيداً لم يُرحَّل. الإقفال يجمع أرصدةً
            مُرحَّلة؛ ترك مسودّةٍ خلفه يعني رقماً يدخل السنة القادمة بلا مقابل.
            رحّلها أو احذفها أوّلاً.
          </Alert>
        ) : null}

        {closed ? (
          <Alert kind="ok" title={`السنة ${fy.name} مُقفَلة`}>
            أُقفلت في <DateText value={closing!.closingDate} />
            {closing!.closedBy ? ` بواسطة ${closing!.closedBy}` : ''} بصافي{' '}
            <Money value={closing!.netProfit} /> على {closing!.accountsClosed} حساباً.
            {canUndo ? <UndoClosing fiscalYearId={fy.id} /> : null}
          </Alert>
        ) : null}

        {closing?.status === 'REVERSED' ? (
          <Alert kind="warn" title="رُجع عن إقفال هذه السنة">
            السجل يبقى ليُقرأ أن السنة أُقفلت ثم فُتحت — وهذا سؤالٌ يُسأل في كل تدقيق.
          </Alert>
        ) : null}

        {!closed && canClose ? (
          <CloseYearForm
            fiscalYearId={fy.id}
            yearName={fy.name}
            blocked={preview.draftEntries > 0}
          />
        ) : null}

        <div className="grid-2">
          <Card title="الإيرادات التي ستُقفَل" hint="كلٌّ برصيده الدائن" flush>
            <ClosingTable rows={preview.revenue} total={preview.totalRevenue} />
          </Card>
          <Card title="المصروفات التي ستُقفَل" hint="كلٌّ برصيده المدين" flush>
            <ClosingTable rows={preview.expense} total={preview.totalExpense} />
          </Card>
        </div>

        {opening ? (
          <Card
            title="الأرصدة الافتتاحية"
            hint={`حسابات الميزانية كما هي في ${opening.asOf.toISOString().slice(0, 10)} — وهي ما تُرحَّل إلى السنة`}
            flush
          >
            {!opening.balanced ? (
              <div style={{ padding: 14 }}>
                <Alert kind="error" title="الأرصدة الافتتاحية لا تتزن">
                  الفرق <Money value={opening.difference} />. ميزانٌ لا يتزن قبل
                  الترحيل يصير سنةً كاملةً لا تتزن بعده.
                </Alert>
              </div>
            ) : null}

            {opening.unclosedTemporary.length > 0 ? (
              <div style={{ padding: '0 14px 14px' }}>
                <Alert kind="warn" title="حسابات مؤقّتة ما زال لها رصيد">
                  {opening.unclosedTemporary.map((r) => `${r.code} ${r.nameAr}`).join('، ')}
                  {' '}— علامةُ سنةٍ سابقة لم تُقفَل.
                </Alert>
              </div>
            ) : null}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الحساب</th>
                    <th className="num" style={{ width: 140 }}>مدين</th>
                    <th className="num" style={{ width: 140 }}>دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {opening.rows.map((r) => (
                    <tr key={r.code}>
                      <td className="num mono">{r.code}</td>
                      <td>{r.nameAr}</td>
                      <td className="num">{r.debit.isZero() ? '—' : <Money value={r.debit} />}</td>
                      <td className="num">{r.credit.isZero() ? '—' : <Money value={r.credit} />}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>الإجمالي</strong></td>
                    <td className="num"><strong><Money value={opening.totalDebit} /></strong></td>
                    <td className="num"><strong><Money value={opening.totalCredit} /></strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ) : null}

        <Card title="حالة السنة">
          <div className="small">
            <Status value={fy.status} /> — {fy.startDate.toISOString().slice(0, 10)} إلى{' '}
            {fy.endDate.toISOString().slice(0, 10)}
          </div>
        </Card>
      </div>
    </>
  );
}

function ClosingTable({
  rows, total,
}: {
  rows: { accountId: string; code: string; nameAr: string; balance: Decimal }[];
  total: Decimal;
}) {
  if (!rows.length) {
    return <div style={{ padding: 16 }}><Empty title="لا أرصدة" hint="لا شيء يُقفَل هنا." /></div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 90 }}>الرمز</th>
            <th>الحساب</th>
            <th className="num" style={{ width: 140 }}>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId}>
              <td className="num mono">{r.code}</td>
              <td>{r.nameAr}</td>
              <td className="num"><Money value={r.balance} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}><strong>الإجمالي</strong></td>
            <td className="num"><strong><Money value={total} /></strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
