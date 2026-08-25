'use client';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { requestClientLink } from '@/app/actions';

function PortalLoginInner() {
  const invalid = useSearchParams().get('invalid');
  const [state, action, pending] = useActionState(requestClientLink, {});
  return (
    <div style={{ maxWidth: 460, margin: '60px auto' }}>
      <div className="card">
        <h1>بوابة العميل</h1>
        <p className="sub">أدخل بريدك الإلكتروني ويصلك رابط دخول آمن بلا كلمة مرور.</p>
        <form action={action}>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={pending}>
              {pending ? 'جارٍ الإرسال' : 'أرسل رابط الدخول'}
            </button>
          </div>
        </form>
        {invalid ? (
          <div className="notice bad">انتهت صلاحية الرابط أو سبق استخدامه. اطلب رابطاً جديداً.</div>
        ) : null}
        {state.error ? <div className="notice bad">{state.error}</div> : null}
        {state.ok ? <div className="notice ok">{state.ok}</div> : null}
        {state.link ? (
          <div className="notice warn">
            وضع التطوير — رابط الدخول:
            <div className="mono" style={{ marginTop: 6 }}><a href={state.link}>{state.link}</a></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PortalLogin() {
  return (
    <Suspense fallback={null}>
      <PortalLoginInner />
    </Suspense>
  );
}
