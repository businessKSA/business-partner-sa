import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { payments } from '@/lib/payments';
import { tamaraEligible } from '@/lib/payments/tamara';
import TamaraButton from './TamaraButton';
import { COMPANY } from '@config/company';

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { payToken: token }, include: { client: true } });
  if (!invoice) notFound();

  if (invoice.status === 'PAID') {
    return (
      <div className="card" style={{ maxWidth: 620, margin: '40px auto' }}>
        <h1>مطالبة السداد {invoice.number}</h1>
        <div className="notice ok">
          سُددت بتاريخ {fmtDate(invoice.paidAt, 'en')}
          {invoice.method ? ` عبر ${invoice.method}` : ''}.
        </div>
        {/* الرقم أعلاه رقم المطالبة في هذه اللوحة، والفاتورة الضريبية المعتمدة
            تصدر من نظام الدفترة بتسلسلها الواحد. عرضهما مفصولين يمنع أن يُقدَّم
            رقم داخلي للعميل — أو لهيئة الزكاة والضريبة — على أنه رقم ضريبي. */}
        {invoice.daftraNumber ? (
          <p className="sub">
            الفاتورة الضريبية: <b>{invoice.daftraNumber}</b>
            {invoice.daftraPdfUrl ? (
              <>
                {' — '}
                <a href={invoice.daftraPdfUrl} target="_blank" rel="noreferrer">افتحها</a>
              </>
            ) : null}
          </p>
        ) : (
          <p className="sub">الفاتورة الضريبية تصلك على بريدك فور صدورها.</p>
        )}
        <a className="btn" href="/portal">بوابة العميل</a>
      </div>
    );
  }

  const provider = payments();
  const tamara = tamaraEligible({
    total: invoice.total,
    isGovFeeDeposit: invoice.isGovFeeDeposit,
    depositKind: invoice.depositKind,
    status: invoice.status,
  });
  // التكلفة تُذكر للعميل كحقيقة عن الخدمة لا كرسم يُضاف عليه — المستحق ثابت
  const feeNote = 'تُقسَّم على دفعات وفق شروط تمارا.';
  const base = process.env.APP_URL || 'http://localhost:3000';
  const intent = await provider.createPayment({
    amount: invoice.total,
    description: `${invoice.number} — ${invoice.titleEn}`,
    callbackUrl: `${base}/api/payments/webhook?invoice=${invoice.id}`,
    metadata: { invoiceId: invoice.id, clientId: invoice.clientId, payToken: token },
  });

  return (
    <div className="card" style={{ maxWidth: 620, margin: '40px auto' }}>
      <h1>سداد المطالبة {invoice.number}</h1>
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

      {invoice.isGovFeeDeposit ? (
        <div className="notice">
          هذا إيداع عهدة يُضاف إلى محفظتك ويُصرف للجهات أو للموردين بإيصالاته — وليس أتعاباً.
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn" href={intent.url}>
          ادفع الآن {provider.supportsApplePay ? '— مدى، فيزا، آبل باي' : '(بيئة اختبار)'}
        </a>
      </div>

      {/* التقسيط لا يُعرض على العهدة: مبلغها يمرّ للجهات ولا إيراد فيه
          يُغطّي خصم تمارا. الشرط في tamaraEligible لا هنا، وهذا عرضه فقط. */}
      {tamara.ok ? <TamaraButton payToken={token} fee={feeNote} /> : null}

      <h3>التحويل البنكي</h3>
      <p className="muted">
        {COMPANY.bank.name.ar} — المستفيد {COMPANY.bank.beneficiary.ar}
        <br />
        الآيبان <span dir="ltr">{COMPANY.bank.iban}</span>
      </p>
    </div>
  );
}
