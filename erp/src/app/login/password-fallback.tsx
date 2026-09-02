'use client';

import { useState } from 'react';

/**
 * الدخول بكلمة المرور — مطويّاً خلف رابط.
 *
 * لم يُحذف رغم أن الرابط السحري صار الطريق الأول، لسببين: حساباتٌ قائمة
 * أُنشئت بكلمة مرور ولا يصحّ أن تُقفل دونها فجأةً، **وأن يبقى بابٌ لا
 * يمرّ بالبريد**. فمزوّد البريد إن تعطّل — أو نفدت حصّته، أو حُجبت رسائله
 * في المُهمَل — أصبح كلُّ من في المنشأة خارجها في اللحظة نفسها.
 *
 * وطيُّه مقصود كذلك: يبقى موجوداً ولا يزاحم الطريق الموصى به.
 */
export function PasswordFallback({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="muted small"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            textDecoration: 'underline', font: 'inherit', padding: 0,
          }}
        >
          الدخول بكلمة المرور بدلاً من ذلك
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <form action={action}>
        <div className="field">
          <label htmlFor="pw-email">البريد الإلكتروني</label>
          <input
            id="pw-email" name="email" type="email" required autoComplete="username"
            dir="ltr" style={{ textAlign: 'left' }}
          />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password" name="password" type="password" required
            autoComplete="current-password" dir="ltr" style={{ textAlign: 'left' }}
          />
        </div>
        <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
          دخول بكلمة المرور
        </button>
      </form>
    </div>
  );
}
