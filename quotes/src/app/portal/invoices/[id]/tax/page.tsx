import { notFound } from 'next/navigation';
import Link from 'next/link';
import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { TaxInvoiceView } from '@/components/TaxInvoiceView';

export const dynamic = 'force-dynamic';

/**
 * نسخة العميل من فاتورته الضريبية. الحارس يقيّدها بصاحبها: العميل يرى
 * فواتيره هو فقط، ورقم الفاتورة في الرابط لا يكفي للوصول إليها.
 */
export default async function PortalTaxInvoice({ params }: { params: Promise<{ id: string }> }) {
  const clientId = await guardClient();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, clientId },
    include: { zatcaRecord: true },
  });
  if (!invoice || !invoice.zatcaRecord) notFound();

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" href="/portal/invoices">فواتيري</Link>
        <span className="sub">للحفظ نسخةً PDF: طباعة المتصفح (Ctrl+P)</span>
      </div>
      <TaxInvoiceView d={{ ...invoice.zatcaRecord, lineTitle: invoice.titleAr }} />
    </>
  );
}
