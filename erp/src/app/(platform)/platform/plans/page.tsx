import { requirePlatformAdmin } from '@/lib/platform.ts';
import { withoutTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Empty } from '@/components/ui.tsx';
import { PERMISSIONS } from '@/lib/rbac.ts';

const MODULE_AR: Record<string, string> = {
  ACCOUNTING: 'المحاسبة', SALES: 'المبيعات', PURCHASE: 'المشتريات',
  TREASURY: 'الخزينة', INVENTORY: 'المخزون', HR: 'الموارد البشرية',
  PROJECTS: 'المشاريع', ZATCA: 'الفوترة الإلكترونية',
};

export default async function PlansPage() {
  await requirePlatformAdmin();

  const plans = await withoutTenant('لوحة المنصة: عرض الباقات', (tx) =>
    tx.plan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
  );

  return (
    <>
      <PageHead title="الباقات" sub={`${plans.length} باقة`} />

      <div className="content">
        <Card flush>
          {plans.length === 0 ? (
            <Empty
              title="لا باقات بعد"
              hint="أنشئها بـ npm run seed:plans، أو أضِفها من قاعدة البيانات مباشرةً."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>الرمز</th>
                    <th>الباقة</th>
                    <th className="num" style={{ width: 130 }}>شهرياً</th>
                    <th className="num" style={{ width: 130 }}>سنوياً</th>
                    <th className="num" style={{ width: 100 }}>حدّ المستخدمين</th>
                    <th className="num" style={{ width: 100 }}>حدّ الفواتير</th>
                    <th>الموديولات</th>
                    <th className="num" style={{ width: 90 }}>المشتركون</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.code}</td>
                      <td>{p.nameAr}<div className="muted small">{p.nameEn}</div></td>
                      <td className="num"><Money value={p.monthlyPrice} /></td>
                      <td className="num"><Money value={p.yearlyPrice} /></td>
                      <td className="num">{p.maxUsers}</td>
                      <td className="num">{p.maxInvoices.toLocaleString('en')}</td>
                      <td className="small">
                        {((p.modules as string[]) ?? [])
                          .map((m) => MODULE_AR[m] ?? m).join('، ') || 'الكل'}
                      </td>
                      <td className="num">{p._count.subscriptions}</td>
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
