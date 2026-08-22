import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { payUrl } from '@/lib/send';
import { SendInvoiceLink } from './InvoiceActions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  CANCELLED: 'ملغاة',
  REFUNDED: 'مستردة',
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await guardAdmin();
  const { created } = await searchParams;
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: { client: true },
    take: 200,
  });

  const due = invoices.filter((i) => i.status === 'DUE');
  const dueTotal = due.reduce((sum, i) => sum + i.total, 0);
  const paidTotal = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);

  return (
    <>
      <h1>الفواتير</h1>
      <p className="sub">إصدار فاتورة لأي عميل، ورابط سداد يُرسل بالبريد أو بالواتساب — مدى وفيزا وآبل باي، أو تحويل بنكي.</p>

      {created ? <div className="notice ok">أُصدرت الفاتورة {created}.</div> : null}

      <div className="grid c3" style={{ margin: '14px 0' }}>
        <div className="card">
          <div className="sub">مستحقة</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(dueTotal)} ريال</div>
        </div>
        <div className="card">
          <div className="sub">محصّلة</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(paidTotal)} ريال</div>
        </div>
        <div className="card">
          <div className="sub">عدد الفواتير المستحقة</div>
          <div className="num" style={{ fontSize: 22 }}>{due.length}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn" href="/admin/invoices/new">فاتورة جديدة</Link>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>العميل</th>
              <th className="num">غير شامل الضريبة</th>
              <th className="num">الضريبة</th>
              <th className="num">الإجمالي</th>
              <th>الحالة</th>
              <th className="num">الاستحقاق</th>
              <th>الإرسال</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <b>{inv.number}</b>
                  <div className="sub">{inv.titleAr}</div>
                </td>
                <td>{inv.client.companyAr || inv.client.nameAr}</td>
                <td className="num">{fmtMoney(inv.amountExclVat)}</td>
                <td className="num">{inv.vatAmount ? fmtMoney(inv.vatAmount) : '—'}</td>
                <td className="num"><b>{fmtMoney(inv.total)}</b></td>
                <td>
                  {STATUS_LABEL[inv.status] || inv.status}
                  {inv.depositKind ? <div className="sub">عهدة</div> : null}
                </td>
                <td className="num">{inv.dueDate ? fmtDate(inv.dueDate, 'en') : '—'}</td>
                <td>
                  {inv.status === 'PAID' ? (
                    <span className="sub">سُددت {fmtDate(inv.paidAt, 'en')}</span>
                  ) : (
                    <SendInvoiceLink invoiceId={inv.id} payLink={payUrl(inv.payToken)} />
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="sub">لا توجد فواتير بعد.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
