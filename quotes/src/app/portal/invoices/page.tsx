import Link from 'next/link';
import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { INVOICE_STATUS_LABEL } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function PortalInvoices() {
  const clientId = await guardClient();
  const invoices = await prisma.invoice.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
  const due = invoices.filter((i) => i.status === 'DUE');

  return (
    <>
      <h1>الفواتير</h1>
      <p className="sub">
        فواتيرك ومدفوعاتك. السداد بمدى أو البطاقات أو آبل باي أو STC Pay يُقيَّد فوراً،
        والتحويل البنكي يُقيَّد بعد تأكيد وصوله.
      </p>

      {due.length ? (
        <div className="notice warn">
          لديك {due.length} فاتورة مستحقة بإجمالي {fmtMoney(due.reduce((a, i) => a + i.total, 0))} ريال.
        </div>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr><th>المطالبة</th><th>الفاتورة الضريبية</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">التاريخ</th><th /></tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.number}</td>
                {/* رقمان لا رقم: الأول مطالبة هذه اللوحة، والثاني الفاتورة
                    الضريبية من الدفترة بتسلسل المنشأة الواحد. */}
                <td className="mono">
                  {i.daftraNumber ? (
                    i.daftraPdfUrl
                      ? <a href={i.daftraPdfUrl} target="_blank" rel="noreferrer">{i.daftraNumber}</a>
                      : i.daftraNumber
                  ) : <span className="muted">—</span>}
                </td>
                <td>
                  {i.titleAr}
                  {i.isGovFeeDeposit ? <div className="muted" style={{ fontSize: 12 }}>عهدة — لا ضريبة عليها</div> : null}
                </td>
                <td className="num">{fmtMoney(i.total)}</td>
                <td>{INVOICE_STATUS_LABEL[i.status]?.ar ?? i.status}</td>
                <td className="num">{fmtDate(i.createdAt, 'en')}</td>
                <td className="num">
                  {i.status === 'DUE' ? (
                    <Link className="btn sm" href={`/portal/pay/${i.payToken}`}>ادفع الآن</Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!invoices.length ? <tr><td colSpan={7} className="muted">لا فواتير بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
