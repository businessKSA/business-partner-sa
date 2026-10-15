import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { COST_CENTER, EXPENSE_CATEGORY, PAY_METHOD, costCenterLabel, expenseCategoryLabel } from '@/lib/finance-enums';
import { ExpenseForm } from './ExpenseForm';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await guardAdmin();
  const { created } = await searchParams;
  const expenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    take: 200,
  });
  const totalNet = expenses.reduce((s, e) => s + e.amountExclVat, 0);
  const totalVat = expenses.reduce((s, e) => s + (e.vendorVat ? e.vatAmount : 0), 0);

  return (
    <>
      <h1>المصاريف</h1>
      <p className="sub">
        كل مصروف يُحمَّل على قسمه — رواتب على الموارد البشرية، إعلانات على التسويق،
        توريد على المشتريات — فتقرأ كلفة كل قسم من نفس الدفتر.
      </p>

      {created ? <div className="notice ok">قُيِّد المصروف {created}.</div> : null}

      <ExpenseForm
        centers={Object.entries(COST_CENTER).map(([key, v]) => ({ key, label: v.ar }))}
        categories={Object.entries(EXPENSE_CATEGORY).map(([key, v]) => ({ key, label: v.ar }))}
        methods={Object.entries(PAY_METHOD).map(([key, label]) => ({ key, label }))}
      />

      <div className="grid c2" style={{ margin: '14px 0' }}>
        <div className="card">
          <div className="sub">إجمالي المصاريف (آخر 200 قيد)</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(totalNet)} ريال</div>
        </div>
        <div className="card">
          <div className="sub">ضريبة مدخلات قابلة للخصم</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(totalVat)} ريال</div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الرقم</th>
              <th className="num">التاريخ</th>
              <th>القسم</th>
              <th>التصنيف</th>
              <th>المورّد</th>
              <th>الوصف</th>
              <th className="num">المبلغ</th>
              <th className="num">الضريبة</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={8} className="sub">لا مصاريف مقيّدة بعد.</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.number}</b></td>
                  <td className="num">{fmtDate(e.date, 'ar')}</td>
                  <td>{costCenterLabel(e.costCenter)}</td>
                  <td>{expenseCategoryLabel(e.category)}</td>
                  <td>{e.vendorName}</td>
                  <td className="sub">{e.descAr}</td>
                  <td className="num">{fmtMoney(e.amountExclVat)}</td>
                  <td className="num">{e.vatAmount ? fmtMoney(e.vatAmount) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
