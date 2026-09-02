import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Money } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { RunForm, RunActions } from './run-actions.tsx';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export default async function DepreciationPage() {
  const session = await requireAuth('assets.asset.read');
  const canRun = can(session.permissions, 'assets.depreciation.run');
  const canPost = can(session.permissions, 'assets.depreciation.post');

  const runs = await withTenant(session.tenantId, (tx) =>
    tx.depreciationRun.findMany({
      where: { tenantId: session.tenantId },
      include: {
        entries: {
          include: { asset: { select: { code: true, nameAr: true } } },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24,
    }),
  );

  return (
    <>
      <PageHead
        title="مسيّرات الاستهلاك"
        sub="يُولَّد المسيّر أوّلاً ليُراجَع، ثم يُرحَّل. والمراجعة قبل الترحيل هي الفرق."
      />

      <div className="content">
        {canRun ? <RunForm /> : null}

        {runs.length === 0 ? (
          <Card>
            <Empty
              title="لا مسيّرات بعد"
              hint="ولّد مسيّر الشهر ليُحسب قسط كل أصل مستحقّ."
            />
          </Card>
        ) : null}

        {runs.map((run) => (
          <Card
            key={run.id}
            title={`${run.number} — ${MONTHS_AR[run.month - 1]} ${run.year}`}
            hint={`${run.assetCount} أصلاً · تاريخ المسيّر ${run.runDate.toISOString().slice(0, 10)}`}
            actions={
              <>
                <Status value={run.status} />
                {canPost ? <RunActions runId={run.id} status={run.status} /> : null}
              </>
            }
            flush
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الأصل</th>
                    <th style={{ width: 110 }}>الفترة</th>
                    <th className="num" style={{ width: 130 }}>قسط الشهر</th>
                    <th className="num" style={{ width: 150 }}>القيمة الدفترية بعده</th>
                  </tr>
                </thead>
                <tbody>
                  {run.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="num mono">{e.asset.code}</td>
                      <td>{e.asset.nameAr}</td>
                      <td className="mono small">{e.period.toISOString().slice(0, 7)}</td>
                      <td className="num"><Money value={e.amount} /></td>
                      <td className="num"><Money value={e.bookValueAfter} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>الإجمالي</strong></td>
                    <td className="num"><strong><Money value={run.totalAmount} /></strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {run.postedAt ? (
              <div className="small muted" style={{ padding: '8px 14px' }}>
                رُحّل في <DateText value={run.postedAt} />
                {run.createdBy ? ` — ولّده ${run.createdBy}` : ''}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
