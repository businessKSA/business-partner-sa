import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { NewInvoiceForm } from './NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  await guardAdmin();
  const clients = await prisma.client.findMany({
    orderBy: { nameAr: 'asc' },
    select: { id: true, nameAr: true, companyAr: true },
  });

  return (
    <>
      <h1>فاتورة جديدة</h1>
      <p className="sub">
        فاتورة مستقلة لأي عميل، غير مرتبطة بعقد. ينتج عنها رابط سداد يُفتح بلا تسجيل دخول،
        ترسله بالبريد أو بالواتساب.
      </p>
      <NewInvoiceForm
        clients={clients.map((c) => ({
          id: c.id,
          label: c.companyAr ? `${c.companyAr} — ${c.nameAr}` : c.nameAr,
        }))}
      />
    </>
  );
}
