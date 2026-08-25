'use client';
import { useActionState } from 'react';
import { actionAdoptSitePrices, actionFixOpenPrices } from '@/app/actions';

type Res = { ok?: string; error?: string };

/**
 * إجراءان جماعيان، كلاهما يقول ما سيفعله قبل الضغط ويُفصّل ما فعله بعده.
 *
 * الترتيب مقصود: تُعتمد أسعار الموقع أولاً، ثم تُثبَّت — فلا يُثبَّت رقم
 * يخالف ما هو منشور للعميل.
 */
export default function FixPrices({ pending: count }: { pending: number }) {
  const [adopt, adoptAction, adopting] = useActionState(
    async () => actionAdoptSitePrices(),
    {} as Res,
  );
  const [state, action, busy] = useActionState(async () => actionFixOpenPrices(), {} as Res);

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form action={adoptAction}>
        <div className="notice">
          <b>الخطوة الأولى — اعتماد أسعار الموقع.</b> الرقم المنشور على الموقع هو
          الصحيح، فتُطابقه اللوحة مرة واحدة. بعدها تصير اللوحة هي المصدر، ويقرأ
          الموقع منها في كل نشر.
        </div>
        <button className="btn ghost" type="submit" disabled={adopting}>
          {adopting ? 'جارٍ الاعتماد' : 'اعتمد أسعار الموقع'}
        </button>
        {adopt.ok ? <div className="notice ok">{adopt.ok}</div> : null}
        {adopt.error ? <div className="notice bad">{adopt.error}</div> : null}
      </form>

      {count ? (
        <form action={action}>
          <div className="notice warn">
            <b>الخطوة الثانية.</b> <b>{count}</b> خدمة عليها سعر معلن لكنها ما زالت
            «سعراً مفتوحاً»، فطلب العميل يصلك لتسعّرها بدل أن يصدر عرضها وحده.
            اضغط بعد اعتماد أسعار الموقع، لا قبله.
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'جارٍ التثبيت' : `ثبّت سعر ${count} خدمة`}
          </button>
          {state.ok ? <div className="notice ok">{state.ok}</div> : null}
          {state.error ? <div className="notice bad">{state.error}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
