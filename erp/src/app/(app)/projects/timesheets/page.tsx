import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Status, DateText, Empty, Kpi } from '@/components/ui.tsx';
import { d, money, Decimal } from '@/lib/money.ts';

export default async function TimesheetsPage() {
  const session = await requireAuth('projects.timesheet.write');

  const sheets = await withTenant(session.tenantId, (tx) =>
    tx.timesheet.findMany({
      where: { tenantId: session.tenantId },
      include: {
        employee: { select: { nameAr: true, code: true } },
        project: { select: { id: true, nameAr: true, code: true } },
        task: { select: { title: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 150,
    }),
  );

  const totalHours = sheets.reduce((s, t) => s.plus(d(t.hours)), new Decimal(0));
  const unbilled = sheets
    .filter((t) => t.billable && !t.invoiced)
    .reduce((s, t) => s.plus(d(t.hours).times(d(t.rate))), new Decimal(0));
  const pending = sheets.filter((t) => t.status !== 'APPROVED').length;

  return (
    <>
      <PageHead title="ساعات العمل" sub={`آخر ${sheets.length} سجلاً`} />

      <div className="content">
        <div className="kpis">
          <Kpi label="مجموع الساعات" value={totalHours.toFixed(1)} />
          <Kpi
            label="قيمة لم تُفوتر"
            value={<Money value={unbilled} currency="ر.س" />}
            tone={unbilled.greaterThan(0) ? 'bad' : undefined}
          />
          <Kpi
            label="بانتظار الاعتماد"
            value={pending}
            tone={pending > 0 ? 'bad' : undefined}
            note="لا تُفوتر قبل اعتمادها"
          />
        </div>

        <Card
          hint="سعر الساعة يُثبَّت لحظة التسجيل — ترقيةُ الموظف لاحقاً لا تعيد كتابة تكلفة مشروعٍ أُغلق."
          flush
        >
          {sheets.length === 0 ? (
            <Empty title="لا ساعات مسجَّلة" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th style={{ width: 150 }}>الموظف</th>
                    <th>المشروع</th>
                    <th>الوصف</th>
                    <th className="num" style={{ width: 70 }}>ساعات</th>
                    <th className="num" style={{ width: 100 }}>السعر</th>
                    <th className="num" style={{ width: 110 }}>القيمة</th>
                    <th style={{ width: 110 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((t) => (
                    <tr key={t.id}>
                      <td><DateText value={t.date} /></td>
                      <td className="small">{t.employee.nameAr}</td>
                      <td className="small">
                        <Link href={`/projects/${t.project.id}`}>{t.project.nameAr}</Link>
                      </td>
                      <td className="small">
                        {t.descAr ?? t.task?.title ?? <span className="muted">—</span>}
                      </td>
                      <td className="num"><Qty value={t.hours} dp={1} /></td>
                      <td className="num"><Money value={t.rate} /></td>
                      <td className="num"><Money value={Number(t.hours) * Number(t.rate)} /></td>
                      <td>
                        <Status value={t.status} />
                        {t.invoiced ? <div><span className="badge ok">مفوترة</span></div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
