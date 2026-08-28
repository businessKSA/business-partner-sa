import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Status, DateText } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth('hr.payroll.read');
  const { id } = await params;

  const run = await withTenant(session.tenantId, (tx) =>
    tx.payrollRun.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        payslips: {
          include: { employee: { select: { code: true, nameAr: true, isSaudi: true, iban: true } } },
          orderBy: { employee: { code: 'asc' } },
        },
      },
    }),
  );

  if (!run) notFound();

  return (
    <>
      <PageHead
        title={`مسيّر رواتب ${MONTHS[run.month - 1]} ${run.year}`}
        sub={`${run.number} · الصرف ${run.payDate.toISOString().slice(0, 10)}`}
        actions={<><PrintButton /><Status value={run.status} /></>}
      />

      <div className="content">
        <Card title="القسائم" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>الرقم</th>
                  <th>الموظف</th>
                  <th className="num">الأساسي</th>
                  <th className="num">البدلات</th>
                  <th className="num">إضافي ومكافآت</th>
                  <th className="num">الإجمالي</th>
                  <th className="num">خصم الغياب</th>
                  <th className="num">التأمينات</th>
                  <th className="num">خصومات أخرى</th>
                  <th className="num">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {run.payslips.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.employee.code}</td>
                    <td>
                      {s.employee.nameAr}
                      {s.employee.iban ? <div className="muted mono small">{s.employee.iban}</div> : null}
                    </td>
                    <td className="num"><Money value={s.basicSalary} /></td>
                    <td className="num">
                      <Money value={
                        Number(s.housingAllowance) + Number(s.transportAllowance) + Number(s.otherAllowance)
                      } />
                    </td>
                    <td className="num"><Money value={Number(s.overtimeAmount) + Number(s.bonus)} /></td>
                    <td className="num"><Money value={s.gross} /></td>
                    <td className="num">
                      {Number(s.absenceDeduction) > 0
                        ? <span className="neg"><Money value={s.absenceDeduction} /></span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="num">
                      {Number(s.gosiEmployee) > 0
                        ? <Money value={s.gosiEmployee} />
                        : <span className="muted">—</span>}
                    </td>
                    <td className="num">
                      <Money value={Number(s.loanDeduction) + Number(s.otherDeduction)} />
                    </td>
                    <td className="num"><Money value={s.net} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>الإجمالي</td>
                  <td className="num"><Money value={run.totalGross} /></td>
                  <td colSpan={2} className="num"><Money value={run.totalDeductions} /></td>
                  <td />
                  <td className="num"><Money value={run.totalNet} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card title="التأمينات الاجتماعية">
          <table>
            <tbody>
              <tr>
                <td>حصة الموظفين (تُخصم من أجورهم)</td>
                <td className="num"><Money value={run.totalGosiEmp} /></td>
              </tr>
              <tr>
                <td>حصة صاحب العمل (تكلفة فوق الأجر)</td>
                <td className="num"><Money value={run.totalGosiEmployer} /></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي المستحق للمؤسسة العامة للتأمينات</td>
                <td className="num">
                  <Money value={Number(run.totalGosiEmp) + Number(run.totalGosiEmployer)} currency="ر.س" />
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </>
  );
}
