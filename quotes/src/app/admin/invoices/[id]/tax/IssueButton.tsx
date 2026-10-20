'use client';

import { useActionState } from 'react';
import { actionIssueTaxInvoice } from '@/app/finance-actions';

export function IssueButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(
    async () => actionIssueTaxInvoice(invoiceId),
    {} as { error?: string; ok?: string },
  );
  return (
    <form action={action}>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'جارٍ الإصدار' : 'أصدر الفاتورة الضريبية'}
      </button>
      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 12 }}>{state.ok}</div> : null}
    </form>
  );
}
