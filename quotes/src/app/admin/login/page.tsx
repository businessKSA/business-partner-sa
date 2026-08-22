'use client';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { requestAdminLink } from '@/app/actions';

function AdminLoginInner() {
  const invalid = useSearchParams().get('invalid');
  const [state, action, pending] = useActionState(requestAdminLink, {});
  return (
    <div className="shell" style={{ maxWidth: 460, paddingTop: 60 }}>
      <div className="card">
        <h1>لوحة التحكم</h1>
        <p className="sub">الدخول ببريدك فقط. يصلك رابط دخول صالح لمدة قصيرة، بلا كلمة مرور.</p>
        <form action={action}>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
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
            <div className="mono" style={{ marginTop: 6 }}>
              <a href={state.link}>{state.link}</a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}
