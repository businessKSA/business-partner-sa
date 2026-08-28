import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { ZATCA_STATUS_LABEL } from '@/lib/finance-enums';
import { TaxInvoiceView } from '@/components/TaxInvoiceView';
import { IssueButton } from './IssueButton';

export const dynamic = 'force-dynamic';

/** الفاتورة الضريبية في اللوحة — نفس نسخة العميل، مع أدوات الإصدار والأرشفة. */
export default async function TaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, zatcaRecord: true },
  });
  if (!invoice) notFound();
  const rec = invoice.zatcaRecord;

  if (!rec) {
    const isCustody = invoice.isGovFeeDeposit || Boolean(invoice.depositKind);
    return (
      <>
        <h1>الفاتورة الضريبية — {invoice.number}</h1>
        <p className="sub">
          لم تصدر فاتورة ضريبية لهذا السداد بعد.
          {invoice.status !== 'PAID' ? ' تصدر الفاتورة الضريبية بعد السداد.' : ''}
          {isCustody ? ' وهذه عهدة لا إيراد، فلا فاتورة ضريبية لها.' : ''}
          {invoice.daftraNumber ? ` (توجد فاتورة دفترة سابقة: ${invoice.daftraNumber})` : ''}
        </p>
        {invoice.status === 'PAID' && !isCustody ? <IssueButton invoiceId={invoice.id} /> : null}
      </>
    );
  }

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <a className="btn ghost sm" href="/admin/invoices">الفواتير</a>
        <a className="btn ghost sm" href="/admin/finance/zatca">سجل زاتكا</a>
        <a className="btn ghost sm" href={`/admin/finance/zatca/${rec.id}/xml`}>تنزيل XML للأرشيف</a>
        <span className="sub">الحالة: {ZATCA_STATUS_LABEL[rec.status] || rec.status}</span>
      </div>

      <TaxInvoiceView d={{ ...rec, lineTitle: invoice.titleAr }} />

      <div className="row no-print" style={{ marginTop: 14, justifyContent: 'center' }}>
        <span className="sub">للطباعة أو الحفظ PDF: طباعة المتصفح (Ctrl+P)</span>
      </div>
    </>
  );
}
