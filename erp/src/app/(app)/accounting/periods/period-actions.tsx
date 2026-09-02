'use client';

import { useActionState } from 'react';
import { togglePeriod, addFiscalYear, type ActionResult } from '@/app/actions/accounting.ts';

export function PeriodActions({
  periodId, status, name,
}: { periodId: string; status: string; name: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(togglePeriod, null);

  if (status === 'LOCKED') {
    return <span className="muted small">مقفلة نهائياً</span>;
  }

  return (
    <>
      <form action={action}>
        <input type="hidden" name="periodId" value={periodId} />
        <input type="hidden" name="action" value={status === 'OPEN' ? 'close' : 'reopen'} />
        <button className="btn sm" type="submit" disabled={pending}>
          {status === 'OPEN' ? 'قفل' : 'إعادة فتح'}
        </button>
      </form>
      {state && !state.ok ? (
        <div className="small neg" style={{ marginTop: 4 }}>{state.error}</div>
      ) : null}
    </>
  );
}

export function NewYearForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addFiscalYear, null);
  const next = new Date().getUTCFullYear() + 1;

  return (
    <div className="card">
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        <form action={action} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 160 }}>
            <label htmlFor="year">إنشاء سنة مالية</label>
            <input id="year" name="year" type="number" defaultValue={next} min={2000} max={2100} />
          </div>
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? 'جارٍ…' : 'إنشاء باثنتي عشرة فترة'}
          </button>
        </form>
      </div>
    </div>
  );
}
