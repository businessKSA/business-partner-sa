'use client';

import { useActionState } from 'react';
import { actionSendInvoiceLink } from '@/app/actions';

/** إرسال رابط السداد بالبريد، مع رابط واتساب جاهز بنص معتمد. */
export function SendInvoiceLink({ invoiceId, payLink }: { invoiceId: string; payLink: string }) {
  const [state, action, pending] = useActionState(actionSendInvoiceLink, {});
  return (
    <div>
      <div className="row">
        <form action={action}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button className="btn sm" type="submit" disabled={pending}>
            {pending ? 'جارٍ الإرسال' : 'أرسل بالبريد'}
          </button>
        </form>
        <a className="btn ghost sm" href={payLink} target="_blank" rel="noopener noreferrer">
          رابط السداد
        </a>
      </div>
      {state.error ? <div className="notice bad" style={{ marginTop: 8 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 8 }}>{state.ok}</div> : null}
      {state.link ? (
        <a className="btn ghost sm" href={state.link} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8 }}>
          افتح واتساب بالنص الجاهز
        </a>
      ) : null}
    </div>
  );
}
