import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { partnerAging } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { PartnerList, type PartnerRow } from '@/components/partner-list.tsx';
import { Decimal } from '@/lib/money.ts';

export default async function VendorsPage() {
  const session = await requireAuth('purchase.partner.read');

  const rows = await withTenant(session.tenantId, async (tx) => {
    const partners = await tx.partner.findMany({
      where: { tenantId: session.tenantId, isVendor: true },
      include: { _count: { select: { vendorBills: true } } },
      orderBy: { code: 'asc' },
    });
    const aging = await partnerAging(tx, session.tenantId, 'PAYABLE', new Date());
    const balances = new Map(aging.map((a) => [a.partnerId, a.total]));

    return partners.map<PartnerRow>((p) => ({
      id: p.id, code: p.code, nameAr: p.nameAr,
      vatNumber: p.vatNumber, city: p.city, phone: p.phone, email: p.email,
      paymentTermDays: p.paymentTermDays, active: p.active,
      balance: balances.get(p.id) ?? new Decimal(0),
      invoiceCount: p._count.vendorBills,
    }));
  });

  return (
    <>
      <PageHead title="الموردون" sub={`${rows.length} مورّداً`} />
      <div className="content">
        <PartnerList rows={rows} kind="VENDOR" />
      </div>
    </>
  );
}
