import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { calculateEosb, type EndReason } from '@/lib/hr/eosb.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { d, money } from '@/lib/money.ts';

/**
 * حاسبة مكافأة نهاية الخدمة.
 *
 * نموذج GET لا حالة عميل: النتيجة تُنسخ برابطها وتُرفق بالمخالصة، ويعود
 * إليها الطرفان عند أي مراجعة فيجدان الحساب نفسه بالمعطيات نفسها.
 */
export default async function EosbPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; endDate?: string; reason?: string; full?: string }>;
}) {
  const session = await requireAuth('hr.employee.read');
  const sp = await searchParams;

  const employees = await withTenant(session.tenantId, (tx) =>
    tx.employee.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true, code: true, nameAr: true, hireDate: true,
        basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowance: true,
      },
      orderBy: { code: 'asc' },
    }),
  );

  const selected = employees.find((e) => e.id === sp.employeeId);
  const endDate = sp.endDate ? new Date(sp.endDate) : new Date();
  const reason = (sp.reason as EndReason) ?? 'TERMINATION';
  const full = sp.full === '1';

  const wage = selected
    ? money(
        d(selected.basicSalary).plus(d(selected.housingAllowance))
          .plus(d(selected.transportAllowance)).plus(d(selected.otherAllowance)),
      )
    : null;

  const result = selected && wage
    ? calculateEosb({
        hireDate: selected.hireDate, endDate, lastWage: wage,
        endReason: reason, fullEntitlement: full,
      })
    : null;

  return (
    <>
      <PageHead
        title="حاسبة مكافأة نهاية الخدمة"
        sub="وفق المادّتين ٨٤ و٨٥ من نظام العمل"
        actions={result ? <PrintButton /> : null}
      />

      <div className="content">
        <form method="get" className="card no-print">
          <div className="card-body">
            <div className="grid-4">
              <div className="field">
                <label htmlFor="employeeId">الموظف</label>
                <select id="employeeId" name="employeeId" defaultValue={sp.employeeId ?? ''}>
                  <option value="">— اختر —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.code} · {e.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="endDate">تاريخ نهاية الخدمة</label>
                <input id="endDate" name="endDate" type="date"
                  defaultValue={endDate.toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label htmlFor="reason">سبب انتهاء الخدمة</label>
                <select id="reason" name="reason" defaultValue={reason}>
                  <option value="TERMINATION">إنهاء من صاحب العمل</option>
                  <option value="RESIGNATION">استقالة</option>
                  <option value="CONTRACT_END">انتهاء مدّة العقد</option>
                  <option value="RETIREMENT">تقاعد</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="full">استحقاق كامل رغم الاستقالة</label>
                <select id="full" name="full" defaultValue={full ? '1' : '0'}>
                  <option value="0">لا</option>
                  <option value="1">نعم — حالة منصوص عليها</option>
                </select>
                <div className="help">
                  الاستقالة لسببٍ مشروع، أو ترك العاملة عملها خلال ستة أشهر من زواجها
                  أو ثلاثة من وضعها.
                </div>
              </div>
            </div>
            <button className="btn primary" type="submit">احسب</button>
          </div>
        </form>

        {result && selected && wage ? (
          <>
            <Card title="النتيجة">
              <table>
                <tbody>
                  <tr><td style={{ width: 260 }}>الموظف</td><td>{selected.nameAr}</td></tr>
                  <tr>
                    <td>تاريخ التعيين</td>
                    <td className="num">{selected.hireDate.toISOString().slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <td>تاريخ نهاية الخدمة</td>
                    <td className="num">{endDate.toISOString().slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <td>مدّة الخدمة</td>
                    <td className="num">
                      {result.serviceYears.toFixed(2)} سنة ({result.serviceDays} يوماً)
                    </td>
                  </tr>
                  <tr><td>الأجر الأخير (الأساسي والبدلات)</td><td className="num"><Money value={wage} /></td></tr>
                  <tr>
                    <td>المكافأة قبل نسبة الاستحقاق</td>
                    <td className="num"><Money value={result.grossAward} /></td>
                  </tr>
                  <tr>
                    <td>نسبة الاستحقاق</td>
                    <td className="num">
                      {result.entitlementRatio.times(100).toFixed(2)}٪
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>المستحقّ</td>
                    <td className="num"><Money value={result.award} currency="ر.س" /></td>
                  </tr>
                </tfoot>
              </table>
            </Card>

            <Alert kind="info" title="أساس الحساب">
              {result.explanation}
            </Alert>

            <p className="muted small">
              الحساب ينفّذ القاعدة العامة: نصف شهر عن كل سنة من الخمس الأولى، وشهر كامل
              عن كل سنة بعدها، وكسور السنة بنسبتها. ولا يُغني عن مراجعة قانونية في
              الحالات الخاصة.
            </p>
          </>
        ) : (
          <Card>
            <p className="muted">اختر موظفاً وتاريخاً لعرض الحساب.</p>
          </Card>
        )}
      </div>
    </>
  );
}
