import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { projectProfitability } from '@/lib/projects/projects.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Pct, Status, DateText, Kpi, Empty, Alert } from '@/components/ui.tsx';

const PRIORITY_AR: Record<string, { ar: string; cls: string }> = {
  LOW: { ar: 'منخفضة', cls: 'mute' }, NORMAL: { ar: 'عادية', cls: 'mute' },
  HIGH: { ar: 'عالية', cls: 'warn' }, URGENT: { ar: 'عاجلة', cls: 'bad' },
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth('projects.project.read');
  const { id } = await params;

  const data = await withTenant(session.tenantId, async (tx) => {
    const project = await tx.project.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        partner: { select: { nameAr: true } },
        tasks: {
          include: { assignee: { select: { nameAr: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        timesheets: {
          include: { employee: { select: { nameAr: true } } },
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });
    if (!project) return null;
    const perf = await projectProfitability(tx, session.tenantId, id);
    return { project, perf };
  });

  if (!data) notFound();
  const { project, perf } = data;

  return (
    <>
      <PageHead
        title={project.nameAr}
        sub={`${project.code}${project.partner ? ` · ${project.partner.nameAr}` : ''}`}
        actions={<Status value={project.status} />}
      />

      <div className="content">
        {perf.overBudget ? (
          <Alert kind="warn" title="تجاوز الميزانية">
            التكلفة المباشرة <Money value={perf.directCost} /> ريالاً والميزانية
            المعتمدة <Money value={perf.budget} /> ريالاً.
          </Alert>
        ) : null}

        {perf.unbilledValue.greaterThan(0) ? (
          <Alert kind="warn" title="ساعات لم تُفوتر">
            <Money value={perf.unbilledValue} /> ريالاً من ساعاتٍ قابلة للفوترة لم يُطالَب بها.
          </Alert>
        ) : null}

        <div className="kpis">
          <Kpi label="الإيراد" value={<Money value={perf.revenue} currency="ر.س" />} />
          <Kpi label="التكلفة المباشرة" value={<Money value={perf.directCost} currency="ر.س" />} />
          <Kpi
            label="مجمل الربح"
            value={<Money value={perf.grossProfit} currency="ر.س" />}
            note={perf.margin ? `هامش ${perf.margin.toFixed(1)}٪` : undefined}
            tone={perf.grossProfit.isNegative() ? 'bad' : 'good'}
          />
          <Kpi
            label="الربح بعد تكلفة الساعات"
            value={<Money value={perf.profitWithLabor} currency="ر.س" />}
            note={`ساعات بتكلفة ${perf.laborCost.toFixed(2)}`}
            tone={perf.profitWithLabor.isNegative() ? 'bad' : 'good'}
          />
        </div>

        <div className="grid-2">
          <Card title="المهام" flush>
            {project.tasks.length === 0 ? (
              <Empty title="لا مهام" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>المهمة</th>
                      <th style={{ width: 130 }}>المسؤول</th>
                      <th style={{ width: 90 }}>الأولوية</th>
                      <th style={{ width: 110 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.tasks.map((t) => {
                      const pr = PRIORITY_AR[t.priority];
                      return (
                        <tr key={t.id}>
                          <td>{t.title}</td>
                          <td className="small">{t.assignee?.nameAr ?? <span className="muted">—</span>}</td>
                          <td><span className={`badge ${pr.cls}`}>{pr.ar}</span></td>
                          <td><Status value={t.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="ساعات العمل"
            hint={`${perf.totalHours.toFixed(1)} ساعة، منها ${perf.billableHours.toFixed(1)} قابلة للفوترة`}
            flush
          >
            {project.timesheets.length === 0 ? (
              <Empty title="لا ساعات مسجَّلة" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 105 }}>التاريخ</th>
                      <th style={{ width: 130 }}>الموظف</th>
                      <th>الوصف</th>
                      <th className="num" style={{ width: 70 }}>ساعات</th>
                      <th className="num" style={{ width: 100 }}>القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.timesheets.map((t) => (
                      <tr key={t.id}>
                        <td><DateText value={t.date} /></td>
                        <td className="small">{t.employee.nameAr}</td>
                        <td className="small">
                          {t.descAr ?? <span className="muted">—</span>}
                          {!t.billable
                            ? <span className="badge mute" style={{ marginInlineStart: 4 }}>غير قابلة للفوترة</span>
                            : t.invoiced
                              ? <span className="badge ok" style={{ marginInlineStart: 4 }}>مفوترة</span>
                              : null}
                        </td>
                        <td className="num"><Qty value={t.hours} dp={1} /></td>
                        <td className="num">
                          <Money value={Number(t.hours) * Number(t.rate)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
