import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { calculateGosi } from '@/lib/hr/gosi.ts';
import { calculateEosb } from '@/lib/hr/eosb.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty, Kpi } from '@/components/ui.tsx';
import { d, money, Decimal } from '@/lib/money.ts';

export default async function EmployeesPage() {
  const session = await requireAuth('hr.employee.read');
  const now = new Date();

  const employees = await withTenant(session.tenantId, (tx) =>
    tx.employee.findMany({
      where: { tenantId: session.tenantId },
      include: { department: { select: { nameAr: true } }, position: { select: { nameAr: true } } },
      orderBy: { code: 'asc' },
    }),
  );

  const rows = employees.map((e) => {
    const wage = money(
      d(e.basicSalary).plus(d(e.housingAllowance)).plus(d(e.transportAllowance)).plus(d(e.otherAllowance)),
    );
    const gosi = calculateGosi({
      basicSalary: e.basicSalary, housingAllowance: e.housingAllowance,
      isSaudi: e.isSaudi, subject: e.gosiSubject,
    });
    // التزام نهاية الخدمة المتراكم حتى اليوم — لو انتهت خدمته الآن
    const eosb = calculateEosb({
      hireDate: e.hireDate, endDate: now, lastWage: wage, endReason: 'TERMINATION',
    });
    return { e, wage, gosi, eosb };
  });

  const active = rows.filter((r) => r.e.status === 'ACTIVE');
  const totalWages = active.reduce((s, r) => s.plus(r.wage), new Decimal(0));
  const totalEmployerGosi = active.reduce((s, r) => s.plus(r.gosi.employer), new Decimal(0));
  const totalEosb = rows
    .filter((r) => r.e.status !== 'TERMINATED')
    .reduce((s, r) => s.plus(r.eosb.grossAward), new Decimal(0));
  const saudiCount = active.filter((r) => r.e.isSaudi).length;
  const saudization = active.length ? Math.round((saudiCount / active.length) * 100) : 0;

  return (
    <>
      <PageHead title="الموظفون" sub={`${active.length} على رأس العمل من ${employees.length}`} />

      <div className="content">
        <div className="kpis">
          <Kpi label="إجمالي الأجور الشهرية" value={<Money value={totalWages} currency="ر.س" />} />
          <Kpi
            label="حصة صاحب العمل في التأمينات"
            value={<Money value={totalEmployerGosi} currency="ر.س" />}
            note="شهرياً — تكلفة فوق الأجر"
          />
          <Kpi
            label="التزام نهاية الخدمة المتراكم"
            value={<Money value={totalEosb} currency="ر.س" />}
            note="لو انتهت خدمة الجميع اليوم"
          />
          <Kpi label="نسبة السعودة" value={`${saudization}٪`} note={`${saudiCount} سعودياً`} />
        </div>

        <Card
          hint="التزام نهاية الخدمة ينشأ مع كل شهر عمل لا لحظة الانفصال — ومنشأةٌ لا تُجنّبه تُظهر ربحاً أعلى من حقيقته."
          flush
        >
          {rows.length === 0 ? (
            <Empty title="لا موظفون" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرقم</th>
                    <th>الاسم</th>
                    <th style={{ width: 90 }}>الجنسية</th>
                    <th style={{ width: 120 }}>القسم</th>
                    <th style={{ width: 105 }}>التعيين</th>
                    <th className="num" style={{ width: 80 }}>الخدمة</th>
                    <th className="num" style={{ width: 120 }}>الأجر</th>
                    <th className="num" style={{ width: 110 }}>خصم التأمينات</th>
                    <th className="num" style={{ width: 130 }}>نهاية الخدمة</th>
                    <th style={{ width: 100 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ e, wage, gosi, eosb }) => (
                    <tr key={e.id}>
                      <td className="mono">{e.code}</td>
                      <td>
                        {e.nameAr}
                        {e.position ? <div className="muted small">{e.position.nameAr}</div> : null}
                      </td>
                      <td>
                        <span className={`badge ${e.isSaudi ? 'ok' : 'mute'}`}>
                          {e.isSaudi ? 'سعودي' : e.nationality}
                        </span>
                      </td>
                      <td>{e.department?.nameAr ?? <span className="muted">—</span>}</td>
                      <td><DateText value={e.hireDate} /></td>
                      <td className="num">{eosb.serviceYears.toFixed(1)}</td>
                      <td className="num"><Money value={wage} /></td>
                      <td className="num">
                        {gosi.employee.isZero()
                          ? <span className="muted">—</span>
                          : <Money value={gosi.employee} />}
                      </td>
                      <td className="num"><Money value={eosb.grossAward} /></td>
                      <td><Status value={e.status} /></td>
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
