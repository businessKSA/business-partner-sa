import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, round2 } from '@/lib/money';
import { COST_CENTER, costCenterLabel } from '@/lib/finance-enums';
import { EmployeeForm, PayrollForm, ArchiveEmployeeButton } from './HrForms';

export const dynamic = 'force-dynamic';

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await guardAdmin();
  const { edit } = await searchParams;
  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ status: 'asc' }, { nameAr: 'asc' }] }),
    prisma.payrollRun.findMany({ orderBy: { month: 'desc' }, take: 24, include: { lines: true } }),
  ]);
  const active = employees.filter((e) => e.status === 'ACTIVE');
  const editing = edit ? employees.find((e) => e.id === edit) ?? null : null;
  const monthlyCost = round2(active.reduce((s, e) => s + e.basicSalary + e.allowances + e.gosiEmployer, 0));
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  return (
    <>
      <h1>الموارد البشرية والرواتب</h1>
      <p className="sub">
        سجلّ الموظفين ومسيّرات الرواتب. كل مسير يتحول آلياً إلى مصاريف على مراكز
        تكلفة الأقسام فتظهر كلفة الموارد البشرية في لوحة المالية دون قيد يدوي.
      </p>

      <div className="grid c3" style={{ margin: '14px 0' }}>
        <div className="card">
          <div className="sub">موظفون نشطون</div>
          <div className="num" style={{ fontSize: 22 }}>{active.length}</div>
        </div>
        <div className="card">
          <div className="sub">كلفة الرواتب الشهرية (مع التأمينات)</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(monthlyCost)} ريال</div>
        </div>
        <div className="card">
          <div className="sub">مسيّرات مقيّدة</div>
          <div className="num" style={{ fontSize: 22 }}>{runs.length}</div>
        </div>
      </div>

      <div className="grid c2">
        <EmployeeForm
          centers={Object.entries(COST_CENTER).map(([key, v]) => ({ key, label: v.ar }))}
          employee={editing}
        />
        <PayrollForm defaultMonth={defaultMonth} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>الموظفون</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>القسم</th>
              <th className="num">أساسي</th>
              <th className="num">بدلات</th>
              <th className="num">تأمينات المنشأة</th>
              <th className="num">صافي التحويل</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={8} className="sub">لا موظفين بعد — أضف أول موظف من النموذج أعلاه.</td></tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} style={e.status === 'ARCHIVED' ? { opacity: 0.5 } : undefined}>
                  <td><b>{e.nameAr}</b><div className="sub">{e.jobTitleAr || ''}</div></td>
                  <td>{costCenterLabel(e.costCenter)}</td>
                  <td className="num">{fmtMoney(e.basicSalary)}</td>
                  <td className="num">{fmtMoney(e.allowances)}</td>
                  <td className="num">{fmtMoney(e.gosiEmployer)}</td>
                  <td className="num">{fmtMoney(round2(e.basicSalary + e.allowances - e.gosiEmployee))}</td>
                  <td>{e.status === 'ACTIVE' ? 'نشط' : 'مؤرشف'}</td>
                  <td className="row" style={{ gap: 6 }}>
                    <Link className="btn ghost sm" href={`/admin/finance/hr?edit=${e.id}`}>تعديل</Link>
                    <ArchiveEmployeeButton id={e.id} active={e.status === 'ACTIVE'} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>مسيّرات الرواتب</h3>
        <table>
          <thead>
            <tr>
              <th>الشهر</th>
              <th className="num">موظفون</th>
              <th className="num">صافي التحويلات</th>
              <th className="num">التأمينات</th>
              <th className="num">كلفة المنشأة</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr><td colSpan={5} className="sub">لا مسيّرات مقيّدة بعد.</td></tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr"><b>{r.month}</b></td>
                  <td className="num">{r.lines.length}</td>
                  <td className="num">{fmtMoney(r.totalNet)}</td>
                  <td className="num">{fmtMoney(r.totalGosi)}</td>
                  <td className="num">{fmtMoney(r.totalCost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
