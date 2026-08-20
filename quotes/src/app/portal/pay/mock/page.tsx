import { redirect } from 'next/navigation';
import { guardClient } from '@/lib/guard';
import { fmtMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

/** شاشة دفع محاكاة — تعمل عندما PAYMENT_PROVIDER=mock. */
export default async function MockPay({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await guardClient();
  const sp = await searchParams;
  if ((process.env.PAYMENT_PROVIDER || 'mock').toLowerCase() !== 'mock') redirect('/portal');

  const amount = Number(sp.amount || 0);
  const callback = sp.callback || '/portal';
  const ref = sp.ref || '';

  return (
    <div className="card" style={{ maxWidth: 520, margin: '60px auto' }}>
      <h1>بوابة الدفع — بيئة اختبار</h1>
      <p className="sub">{sp.description}</p>
      <div className="notice warn">
        هذه شاشة محاكاة تعمل لأن PAYMENT_PROVIDER=mock. عند ضبطه على moyasar يُفتح هنا
        نموذج Moyasar الحقيقي الذي يدعم مدى وفيزا وآبل باي.
      </div>
      <table>
        <tbody>
          <tr><td>المبلغ المستحق</td><td className="num"><b>{fmtMoney(amount)} ريال</b></td></tr>
          <tr><td>مرجع الدفعة</td><td className="num mono">{ref}</td></tr>
        </tbody>
      </table>
      <form method="get" action="/api/payments/webhook" style={{ marginTop: 16 }}>
        <input type="hidden" name="invoice" value={sp.invoiceId || ''} />
        <input type="hidden" name="ref" value={ref} />
        <input type="hidden" name="status" value="paid" />
        <input type="hidden" name="method" value="mada" />
        <input type="hidden" name="redirect" value="/portal" />
        <button className="btn" type="submit">تأكيد الدفع بنجاح</button>
        <a className="btn ghost" href="/portal" style={{ marginInlineStart: 8 }}>إلغاء</a>
      </form>
      <p className="muted mono" style={{ marginTop: 12 }}>callback: {callback}</p>
    </div>
  );
}
