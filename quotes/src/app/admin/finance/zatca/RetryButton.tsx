'use client';

import { useActionState } from 'react';
import { actionRetryZatca } from '@/app/finance-actions';

export function RetryButton({ recordId }: { recordId: string }) {
  const [state, action, pending] = useActionState(
    async () => actionRetryZatca(recordId),
    {} as { error?: string; ok?: string },
  );
  return (
    <form action={action} style={{ display: 'inline' }}>
      <button className="btn ghost sm" type="submit" disabled={pending}>
        {pending ? 'جارٍ الإبلاغ' : 'إعادة الإبلاغ'}
      </button>
      {state.error ? <span className="sub" style={{ color: '#b42318' }}> {state.error}</span> : null}
    </form>
  );
}
