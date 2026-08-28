'use client';
import { useActionState } from 'react';
import { actionSubmitRfpBid } from '@/app/actions';

export default function BidForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(actionSubmitRfpBid, {});

  if (state.ok) return <div className="notice ok" style={{ marginTop: 16 }}>{state.ok}</div>;

  return (
    <>
      <form className="card" action={action} style={{ marginTop: 16 }}>
        <input type="hidden" name="token" value={token} />

        <label htmlFor="amount">إجمالي عرضكم بالريال — غير شامل ضريبة القيمة المضافة</label>
        <input id="amount" name="amount" type="number" min={1} step="0.01" required dir="ltr" />

        <label htmlFor="deliveryAr" style={{ marginTop: 12 }}>مدة التنفيذ</label>
        <input id="deliveryAr" name="deliveryAr" placeholder="مثال: 10 أيام عمل من تاريخ أمر الشراء" />

        <label htmlFor="notesAr" style={{ marginTop: 12 }}>تفاصيل العرض والبنود</label>
        <textarea id="notesAr" name="notesAr" rows={5} placeholder="اذكر البنود والكميات وما يشمله السعر وما لا يشمله" />

        <label htmlFor="file" style={{ marginTop: 12 }}>عرضكم الرسمي (PDF أو صورة)</label>
        <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'جارٍ الإرسال' : 'أرسل العرض'}
          </button>
        </div>
        {state.error ? <div className="notice bad" style={{ marginTop: 10 }}>{state.error}</div> : null}
      </form>

      {/* الاعتذار زرّ لا صمت: المورد الذي لا يريد الطلب يُعلن ذلك فيُعرف أنه
          رأى ولم يرغب، ولا يُتابَع كأنه لم يفتح الرسالة. */}
      <form action={action} style={{ marginTop: 10 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decline" value="1" />
        <button className="btn ghost sm" type="submit" disabled={pending}>
          نعتذر عن هذا الطلب
        </button>
      </form>
    </>
  );
}
