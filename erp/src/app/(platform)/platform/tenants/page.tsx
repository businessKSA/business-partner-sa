import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/platform.ts';
import { withoutTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty, Kpi, Alert } from '@/components/ui.tsx';
import { TenantRow } from './tenant-row.tsx';
import { d, money, Decimal } from '@/lib/money.ts';

export default async function TenantsPage({
  searchParams,
}: { searchParams: Promise<{ created?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  // لوحة المنصة تقرأ عبر المنشآت كلها — وهو ثالث ثلاثة مواضع مبرَّرة
  // لتجاوز العزل، ومحصورٌ بمالك المنصة.
  const tenants = await withoutTenant('لوحة المنصة: عرض المنشآت المشتركة وأحجامها', (tx) =>
    tx.tenant.findMany({
      include: {
        _count: {
          select: { memberships: true, salesInvoices: true, journalEntries: true, employees: true },
        },
        subscriptions: { include: { plan: true }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );

  const active = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trial = tenants.filter((t) => t.status === 'TRIAL').length;
  const mrr = tenants.reduce((s, t) => {
    const sub = t.subscriptions[0];
    if (!sub || t.status !== 'ACTIVE') return s;
    const price = sub.cycle === 'YEARLY'
      ? d(sub.plan.yearlyPrice).dividedBy(12)
      : d(sub.plan.monthlyPrice);
    return s.plus(price);
  }, new Decimal(0));

  return (
    <>
      <PageHead
        title="المنشآت المشتركة"
        sub={`${tenants.length} منشأة`}
        actions={<Link className="btn primary" href="/platform/tenants/new">إضافة منشأة</Link>}
      />

      <div className="content">
        {sp.created ? (
          <Alert kind="ok" title="أُنشئت المنشأة">
            «{sp.created}» جاهزة للعمل: شجرة حسابات كاملة، وسنة مالية بفتراتها، ورموز
            ضريبية، وأدوار، ومستودع، وحساب صندوق. سلّم المالك بريده وكلمة المرور المؤقتة.
          </Alert>
        ) : null}

        <div className="kpis">
          <Kpi label="منشآت نشطة" value={active} />
          <Kpi label="تحت التجربة" value={trial} />
          <Kpi label="الإيراد الشهري المتكرّر" value={<Money value={mrr} currency="ر.س" />} />
          <Kpi
            label="إجمالي المستخدمين"
            value={tenants.reduce((n, t) => n + t._count.memberships, 0)}
          />
        </div>

        <Card flush>
          {tenants.length === 0 ? (
            <Empty
              title="لا منشآت بعد"
              action={<Link className="btn primary" href="/platform/tenants/new">إضافة أول منشأة</Link>}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>المعرّف</th>
                    <th>المنشأة</th>
                    <th style={{ width: 140 }}>الرقم الضريبي</th>
                    <th style={{ width: 130 }}>الباقة</th>
                    <th className="num" style={{ width: 70 }}>مستخدمون</th>
                    <th className="num" style={{ width: 70 }}>فواتير</th>
                    <th className="num" style={{ width: 70 }}>موظفون</th>
                    <th style={{ width: 105 }}>الاشتراك</th>
                    <th style={{ width: 110 }}>الحالة</th>
                    <th style={{ width: 220 }} />
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <TenantRow
                      key={t.id}
                      tenant={{
                        id: t.id, slug: t.slug, nameAr: t.nameAr,
                        vatNumber: t.vatNumber, status: t.status,
                        createdAt: t.createdAt.toISOString().slice(0, 10),
                        planName: t.subscriptions[0]?.plan.nameAr ?? null,
                        users: t._count.memberships,
                        invoices: t._count.salesInvoices,
                        employees: t._count.employees,
                      }}
                    />
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
