import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Qty } from '@/components/ui.tsx';

export default async function LeavesPage() {
  const session = await requireAuth('hr.leave.read');

  const requests = await withTenant(session.tenantId, (tx) =>
    tx.leaveRequest.findMany({
      where: { tenantId: session.tenantId },
      include: {
        employee: { select: { code: true, nameAr: true, annualLeaveDays: true } },
        leaveType: { select: { nameAr: true, paid: true } },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    }),
  );

  const pending = requests.filter((r) => r.status === 'PENDING');

  return (
    <>
      <PageHead
        title="الإجازات"
        sub={pending.length ? `${pending.length} طلباً بانتظار الاعتماد` : 'لا طلبات معلّقة'}
      />

      <div className="content">
        <Card flush>
          {requests.length === 0 ? (
            <Empty title="لا طلبات إجازة" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرقم</th>
                    <th>الموظف</th>
                    <th style={{ width: 150 }}>نوع الإجازة</th>
                    <th style={{ width: 105 }}>من</th>
                    <th style={{ width: 105 }}>إلى</th>
                    <th className="num" style={{ width: 80 }}>الأيام</th>
                    <th>السبب</th>
                    <th style={{ width: 110 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.employee.code}</td>
                      <td>{r.employee.nameAr}</td>
                      <td>
                        {r.leaveType.nameAr}
                        {!r.leaveType.paid
                          ? <span className="badge warn" style={{ marginInlineStart: 6 }}>بلا أجر</span>
                          : null}
                      </td>
                      <td><DateText value={r.startDate} /></td>
                      <td><DateText value={r.endDate} /></td>
                      <td className="num"><Qty value={r.days} dp={0} /></td>
                      <td className="small">{r.reason ?? <span className="muted">—</span>}</td>
                      <td><Status value={r.status} /></td>
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
