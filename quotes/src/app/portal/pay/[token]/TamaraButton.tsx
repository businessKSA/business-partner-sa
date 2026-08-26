'use client';

import { useActionState } from 'react';
import { actionStartTamara } from '@/app/actions';

/**
 * زر التقسيط. يفتح جلسة تمارا على الخادم ثم يحوّل العميل إليها — الرابط
 * لا يُبنى في المتصفح لأن المفتاح لا يغادر الخادم.
 */
export default function TamaraButton({ payToken, fee }: { payToken: string; fee: string }) {
  const [state, action, pending] = useActionState(actionStartTamara, {} as { error?: string; link?: string });

  if (state.link) {
    if (typeof window !== 'undefined') window.location.href = state.link;
  }

  return (
    <form action={action} style={{ marginTop: 10 }}>
      <input type="hidden" name="payToken" value={payToken} />
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? 'جارٍ فتح تمارا…' : 'قسّطها عبر تمارا'}
      </button>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        تقسيط بلا فوائد على العميل. المبلغ المستحق كما هو أعلاه — {fee}
      </div>
      {state.error ? (
        <div className="notice err" style={{ marginTop: 8 }}>{state.error}</div>
      ) : null}
    </form>
  );
}
