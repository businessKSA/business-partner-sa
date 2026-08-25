'use client';
import { useActionState } from 'react';
import { actionAcceptQuote } from '@/app/actions';

export default function AcceptBox({ token, ip }: { token: string; ip: string | null }) {
  const [state, action, pending] = useActionState(actionAcceptQuote, {});
  if (state.ok) {
    return (
      <div className="card no-print" style={{ maxWidth: 900, margin: '18px auto' }}>
        <div className="notice ok">{state.ok}</div>
      </div>
    );
  }
  return (
    <div className="card no-print" style={{ maxWidth: 900, margin: '18px auto' }}>
      <h2>قبول العرض / Accept</h2>
      <p className="muted">
        بالضغط على «قبول العرض» يُسجَّل اسمك وتاريخ ووقت القبول.
        <span style={{ display: 'block', direction: 'ltr', textAlign: 'left' }}>
          By pressing Accept, your name and the date and time of acceptance are recorded.
        </span>
      </p>
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="ip" value={ip ?? ''} />
        <label htmlFor="name">الاسم الكامل / Full name</label>
        <input id="name" name="name" required maxLength={120} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'جارٍ التسجيل' : 'قبول العرض / Accept'}
          </button>
        </div>
      </form>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
    </div>
  );
}
