import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { partnerAging } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { PartnerList, type PartnerRow } from '@/components/partner-list.tsx';
import { Decimal } from '@/lib/money.ts';

export default async function CustomersPage() {
  const session = await requireAuth('sales.partner.read');

  const rows = await withTenant(session.tenantId, async (tx) => {
    const partners = await tx.partner.findMany({
      where: { tenantId: session.tenantId, isCustomer: true },
      include: { _count: { select: { salesInvoices: true } } },
      orderBy: { code: 'asc' },
    });
    const aging = await partnerAging(tx, session.tenantId, 'RECEIVABLE', new Date());
    const balances = new Map(aging.map((a) => [a.partnerId, a.total]));

    return partners.map<PartnerRow>((p) => ({
      id: p.id, code: p.code, nameAr: p.nameAr,
      vatNumber: p.vatNumber, city: p.city, phone: p.phone, email: p.email,
      paymentTermDays: p.paymentTermDays, active: p.active,
      balance: balances.get(p.id) ?? new Decimal(0),
      invoiceCount: p._count.salesInvoices,
    }));
  });

  return (
    <>
      <PageHead title="العملاء" sub={`${rows.length} عميلاً`} />
      <div className="content">
        <PartnerList rows={rows} kind="CUSTOMER" />
      </div>
    </>
  );
}
