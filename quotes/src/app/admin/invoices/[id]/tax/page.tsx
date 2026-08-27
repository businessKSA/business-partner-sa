import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDateTime } from '@/lib/money';
import { COMPANY } from '@config/company';
import { qrSvg } from '@/lib/zatca/qrcode';
import { ZATCA_STATUS_LABEL } from '@/lib/finance-enums';
import { IssueButton } from './IssueButton';

export const dynamic = 'force-dynamic';

/**
 * الفاتورة الضريبية للعرض والطباعة — نسخة العميل. الحقول الإلزامية للفاتورة
 * المبسطة كلها هنا: اسم البائع ورقمه الضريبي والسجل، التاريخ والوقت، البنود،
 * الإجمالي والضريبة سطراً مستقلاً، ورمز QR بحمولة TLV المعتمدة.
 */
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
    return (
      <>
        <h1>الفاتورة الضريبية — {invoice.number}</h1>
        <p className="sub">
          لم تصدر فاتورة ضريبية لهذا السداد بعد.
          {invoice.status !== 'PAID' ? ' تصدر الفاتورة الضريبية بعد السداد.' : ''}
          {invoice.daftraNumber ? ` (توجد فاتورة دفترة سابقة: ${invoice.daftraNumber})` : ''}
        </p>
        {invoice.status === 'PAID' && !invoice.isGovFeeDeposit ? (
          <IssueButton invoiceId={invoice.id} />
        ) : null}
      </>
    );
  }

  const isStandard = rec.docType === 'STANDARD';
  return (
    <>
      <div className="row no-print" style={{ marginBottom: 14, gap: 8 }}>
        <a className="btn ghost sm" href="/admin/invoices">الفواتير</a>
        <a className="btn ghost sm" href="/admin/finance/zatca">سجل زاتكا</a>
        <span className="sub">الحالة: {ZATCA_STATUS_LABEL[rec.status] || rec.status}</span>
      </div>

      <div className="card" style={{ maxWidth: 760, margin: '0 auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={COMPANY.brand.logo} alt="" style={{ height: 48, marginBottom: 8 }} />
            <h2 style={{ margin: '0 0 4px' }}>
              {isStandard ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}
              {rec.typeCode === '381' ? ' — إشعار دائن' : rec.typeCode === '383' ? ' — إشعار مدين' : ''}
            </h2>
            <div className="sub">{rec.number}</div>
          </div>
          <div
            style={{ width: 132, height: 132 }}
            dangerouslySetInnerHTML={{ __html: qrSvg(rec.qr, 132) }}
          />
        </div>

        <table style={{ marginTop: 16 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%' }}>
                <b>البائع</b>
                <div>{rec.sellerName}</div>
                <div className="sub">{COMPANY.address.ar}</div>
                <div className="sub" dir="ltr">س.ت {COMPANY.crNumber}</div>
                <div className="sub" dir="ltr">الرقم الضريبي {rec.sellerVat}</div>
              </td>
              <td>
                <b>المشتري</b>
                <div>{rec.buyerName || 'عميل نقدي'}</div>
                {rec.buyerVat ? <div className="sub" dir="ltr">الرقم الضريبي {rec.buyerVat}</div> : null}
                <div className="sub">تاريخ الإصدار: {fmtDateTime(rec.issueAt, 'ar')}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>البيان</th>
              <th className="num">المبلغ غير شامل الضريبة</th>
              <th className="num">الضريبة (15٪)</th>
              <th className="num">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.titleAr}</td>
              <td className="num">{fmtMoney(rec.netAmount)}</td>
              <td className="num">{fmtMoney(rec.vatAmount)}</td>
              <td className="num">{fmtMoney(rec.total)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>الإجمالي المستحق شاملاً ضريبة القيمة المضافة</td>
              <td className="num" colSpan={3}>{fmtMoney(rec.total)} ريال</td>
            </tr>
          </tfoot>
        </table>

        <div className="sub" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span dir="ltr">UUID: {rec.uuid}</span>
          <span dir="ltr">ICV: {rec.icv}</span>
        </div>
      </div>

      <div className="row no-print" style={{ marginTop: 14, justifyContent: 'center' }}>
        <span className="sub">للطباعة أو الحفظ PDF: طباعة المتصفح (Ctrl+P)</span>
      </div>
    </>
  );
}
