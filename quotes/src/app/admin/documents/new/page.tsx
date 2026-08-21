import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import QuoteBuilder from './QuoteBuilder';

export const dynamic = 'force-dynamic';

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await guardAdmin();
  const sp = await searchParams;
  const [clients, services] = await Promise.all([
    prisma.client.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
  ]);

  return (
    <QuoteBuilder
      preselectedClient={sp.client ?? ''}
      clients={clients.map((c) => ({ id: c.id, label: `${c.companyAr || c.nameAr} — ${c.email}` }))}
      services={services.map((s) => ({
        id: s.id,
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descAr: s.descAr ?? '',
        descEn: s.descEn ?? '',
        unitPrice: s.unitPrice,
        unitAr: s.unitAr,
        unitEn: s.unitEn,
        minQty: s.minQty,
        openPrice: s.openPrice,
        paymentTermsAr: s.paymentTermsAr,
        paymentTermsEn: s.paymentTermsEn,
        deliveryAr: s.deliveryAr,
        deliveryEn: s.deliveryEn,
      }))}
    />
  );
}
