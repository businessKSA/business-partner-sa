import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtMoney } from '@/lib/money';
import { COMPANY } from '@config/company';
import { gatewayMethods } from '@/lib/payment-methods';
import MoyasarForm from './MoyasarForm';
import { appBase } from '@/lib/base';

export const dynamic = 'force-dynamic';

/**
 * صفحة السداد الفعلية: تقرأ الفاتورة من قاعدة البيانات برمزها وتحسب المبلغ
 * على الخادم، ثم تسلّمه لنموذج Moyasar. لا يصل أي مبلغ من عنوان الصفحة.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { payToken: token } });
  if (!invoice) notFound();
  if (invoice.status === 'PAID') redirect(`/portal/pay/${token}`);

  const key = process.env.MOYASAR_PUBLISHABLE_KEY;
  const base = appBase();
  // القائمة من تعريف واحد يشترك فيه النموذج وخريطة الكتالوج (lib/payment-methods).
  const methods = gatewayMethods();

  return (
    <div className="card" style={{ maxWidth: 620, margin: '40px auto' }}>
      <h1>سداد الفاتورة {invoice.number}</h1>
      <p className="sub">{invoice.titleAr}</p>
      <table>
        <tbody>
          <tr><td>المبلغ غير شامل الضريبة</td><td className="num">{fmtMoney(invoice.amountExclVat)}</td></tr>
          <tr>
            <td>ضريبة القيمة المضافة <span dir="ltr">{Math.round(invoice.vatRate * 100)}%</span></td>
            <td className="num">{fmtMoney(invoice.vatAmount)}</td>
          </tr>
          <tr><td><b>الإجمالي المستحق</b></td><td className="num"><b>{fmtMoney(invoice.total)} ريال</b></td></tr>
        </tbody>
      </table>

      {key ? (
        <MoyasarForm
          version={process.env.MOYASAR_FORM_VERSION || '1.7.3'}
          publishableKey={key}
          amountHalalas={Math.round(invoice.total * 100)}
          description={`${invoice.number} — ${invoice.titleEn}`}
          callbackUrl={`${base}/api/payments/webhook?invoice=${invoice.id}&redirect=/portal`}
          metadata={{ invoiceId: invoice.id, clientId: invoice.clientId, number: invoice.number }}
          methods={methods}
        />
      ) : (
        <div className="notice warn">
          بوابة الدفع غير مهيّأة بعد. استخدم التحويل البنكي أدناه أو تواصل معنا.
        </div>
      )}

      <h3>التحويل البنكي</h3>
      <p className="muted" style={{ marginTop: -6 }}>
        لمن يفضّل التحويل بدل البطاقة. أرسل إشعار التحويل بعد السداد ليُقيَّد على الفاتورة.
      </p>
      <p className="muted">
        {COMPANY.bank.name.ar} — المستفيد {COMPANY.bank.beneficiary.ar}
        <br />
        الآيبان <span dir="ltr">{COMPANY.bank.iban}</span>
      </p>
      
    </div>
  );
}
