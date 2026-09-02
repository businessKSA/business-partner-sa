import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { d, money } from '@/lib/money.ts';

const DOC_AR: Record<string, string> = {
  INVOICE: 'فاتورة', CREDIT_NOTE: 'إشعار دائن', DEBIT_NOTE: 'إشعار مدين',
};

export default async function InvoicesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await requireAuth('sales.invoice.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 40;
  const status = sp.status;

  const { invoices, total } = await withTenant(session.tenantId, async (tx) => {
    const where = { tenantId: session.tenantId, ...(status ? { status } : {}) };
    const [invoices, total] = await Promise.all([
      tx.salesInvoice.findMany({
        where,
        include: { partner: { select: { nameAr: true } }, zatca: { select: { status: true } } },
        orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      tx.salesInvoice.count({ where }),
    ]);
    return { invoices, total };
  });

  const pages = Math.ceil(total / perPage);
  const filters = [
    ['', 'الكل'], ['DRAFT', 'مسوّدة'], ['POSTED', 'مرحَّلة'],
    ['PARTIALLY_PAID', 'مسدَّدة جزئياً'], ['PAID', 'مسدَّدة'], ['CANCELLED', 'ملغاة'],
  ] as const;

  return (
    <>
      <PageHead
        title="فواتير المبيعات"
        sub={`${total} فاتورة`}
        actions={
          can(session.permissions, 'sales.invoice.create')
            ? <Link className="btn primary" href="/sales/invoices/new">فاتورة جديدة</Link>
            : null
        }
      />

      <div className="content">
        <div className="page-tabs">
          {filters.map(([value, label]) => (
            <Link
              key={value || 'all'}
              href={value ? `/sales/invoices?status=${value}` : '/sales/invoices'}
              className={(status ?? '') === value ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </div>

        <Card flush>
          {invoices.length === 0 ? (
            <Empty title="لا فواتير" hint="أنشئ أول فاتورة لعميلك." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>الرقم</th>
                    <th style={{ width: 100 }}>النوع</th>
                    <th>العميل</th>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th style={{ width: 105 }}>الاستحقاق</th>
                    <th className="num" style={{ width: 130 }}>الإجمالي</th>
                    <th className="num" style={{ width: 130 }}>المتبقّي</th>
                    <th style={{ width: 120 }}>الحالة</th>
                    <th style={{ width: 130 }}>زاتكا</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const remaining = money(d(inv.total).minus(d(inv.paidAmount)));
                    const overdue =
                      inv.dueDate && inv.dueDate < new Date() && remaining.greaterThan(0)
                      && inv.status !== 'CANCELLED';
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/sales/invoices/${inv.id}`} className="mono">{inv.number}</Link>
                        </td>
                        <td className="small">
                          {DOC_AR[inv.docType]}
                          {inv.kind === 'SIMPLIFIED'
                            ? <div className="muted">مبسطة</div> : null}
                        </td>
                        <td>{inv.partner.nameAr}</td>
                        <td><DateText value={inv.issueDate} /></td>
                        <td>
                          <DateText value={inv.dueDate} />
                          {overdue ? <span className="badge bad" style={{ marginInlineStart: 4 }}>متأخّرة</span> : null}
                        </td>
                        <td className="num"><Money value={inv.total} /></td>
                        <td className="num"><Money value={remaining} /></td>
                        <td><Status value={inv.status} /></td>
                        <td>
                          {inv.zatca
                            ? <Status value={inv.zatca.status} />
                            : inv.status === 'DRAFT'
                              ? <span className="muted small">—</span>
                              : <span className="badge mute">لم تُرسل</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pages > 1 ? (
          <div className="actions" style={{ justifyContent: 'center' }}>
            {page > 1 ? (
              <Link className="btn sm" href={`/sales/invoices?page=${page - 1}${status ? `&status=${status}` : ''}`}>السابق</Link>
            ) : null}
            <span className="muted small">صفحة {page} من {pages}</span>
            {page < pages ? (
              <Link className="btn sm" href={`/sales/invoices?page=${page + 1}${status ? `&status=${status}` : ''}`}>التالي</Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
