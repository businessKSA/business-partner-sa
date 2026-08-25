'use client';
import { useActionState } from 'react';
import { actionFixOpenPrices } from '@/app/actions';

/**
 * زر تثبيت الأسعار. يظهر فقط حين يوجد ما يُثبَّت، ويقول بالضبط كم خدمة
 * سيمسّها قبل الضغط — لا إجراء جماعي بلا رقم معلن مسبقاً.
 */
export default function FixPrices({ pending: count }: { pending: number }) {
  const [state, action, busy] = useActionState(
    async () => actionFixOpenPrices(),
    {} as { ok?: string; error?: string },
  );
  if (!count) return null;
  return (
    <form action={action} style={{ marginTop: 12 }}>
      <div className="notice warn">
        <b>{count}</b> خدمة عليها سعر معلن لكنها ما زالت «سعراً مفتوحاً»، فطلب العميل
        يصلك لتسعّرها بدل أن يصدر عرضها وحده.
        <br />
        <b>قبل الضغط:</b> السعر الذي سيُثبَّت هو سعر هذه اللوحة، لا سعر الموقع. شغّل{' '}
        <code>node site/scripts/compare-prices.mjs</code> وتأكد أنهما متطابقان —
        وإلا وصل العميل عرضٌ يخالف الرقم المنشور له.
      </div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'جارٍ التثبيت' : `ثبّت سعر ${count} خدمة`}
      </button>
      {state.ok ? <div className="notice ok">{state.ok}</div> : null}
      {state.error ? <div className="notice bad">{state.error}</div> : null}
    </form>
  );
}
