'use client';

import { useActionState, useState } from 'react';
import { reverseJournalEntry, type ActionResult } from '@/app/actions/accounting.ts';

/**
 * زرّ العكس.
 *
 * يفتح تأكيداً يشرح ما سيحدث قبل أن يحدث: العكس أثرٌ دائم في الدفتر لا
 * تراجع عنه، ومن يضغطه يجب أن يعرف أنه لا يمحو شيئاً بل يضيف قيداً مضادّاً.
 */
export function ReverseButton({ entryId, number }: { entryId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    reverseJournalEntry, null,
  );

  if (!open) {
    return (
      <button className="btn danger sm" type="button" onClick={() => setOpen(true)}>
        عكس القيد
      </button>
    );
  }

  return (
    <form action={action} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="entryId" value={entryId} />

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="rev-date" className="small">تاريخ العكس</label>
        <input id="rev-date" name="date" type="date"
          defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
        <label htmlFor="rev-memo" className="small">السبب</label>
        <input id="rev-memo" name="memoAr" type="text" placeholder={`عكس القيد ${number}`} />
      </div>

      <button className="btn danger" type="submit" disabled={pending}>
        {pending ? 'جارٍ…' : 'تأكيد العكس'}
      </button>
      <button className="btn" type="button" onClick={() => setOpen(false)}>إلغاء</button>

      {state && !state.ok ? (
        <div className="alert error" style={{ width: '100%', marginTop: 8, marginBottom: 0 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
