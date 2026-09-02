import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty } from '@/components/ui.tsx';
import { PeriodActions, NewYearForm } from './period-actions.tsx';
import { can } from '@/lib/rbac.ts';

export default async function PeriodsPage() {
  const session = await requireAuth('accounting.report.read');
  const editable = can(session.permissions, 'accounting.period.close');

  const years = await withTenant(session.tenantId, (tx) =>
    tx.fiscalYear.findMany({
      where: { tenantId: session.tenantId },
      include: {
        periods: {
          orderBy: { number: 'asc' },
          include: { _count: { select: { entries: true } } },
        },
      },
      orderBy: { startDate: 'desc' },
    }),
  );

  return (
    <>
      <PageHead
        title="الفترات المالية"
        sub="قفل الفترة هو الوعد بأن رقماً أُقرَّ لن يتغيّر من خلفه."
      />

      <div className="content">
        {editable ? <NewYearForm /> : null}

        {years.length === 0 ? (
          <Card><Empty title="لا سنوات مالية" hint="أنشئ سنةً لتبدأ الترحيل." /></Card>
        ) : null}

        {years.map((y) => (
          <Card key={y.id} title={`السنة المالية ${y.name}`}
            hint={`${y.startDate.toISOString().slice(0, 10)} — ${y.endDate.toISOString().slice(0, 10)}`}
            flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>الفترة</th>
                    <th style={{ width: 110 }}>من</th>
                    <th style={{ width: 110 }}>إلى</th>
                    <th className="num" style={{ width: 80 }}>القيود</th>
                    <th style={{ width: 120 }}>الحالة</th>
                    {editable ? <th style={{ width: 130 }} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {y.periods.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.number}</td>
                      <td>{p.name}</td>
                      <td><DateText value={p.startDate} /></td>
                      <td><DateText value={p.endDate} /></td>
                      <td className="num">{p._count.entries}</td>
                      <td><Status value={p.status} /></td>
                      {editable ? (
                        <td><PeriodActions periodId={p.id} status={p.status} name={p.name} /></td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
