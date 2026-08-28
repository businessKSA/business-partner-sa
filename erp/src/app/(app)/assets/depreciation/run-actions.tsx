'use client';

import { useActionState } from 'react';
import {
  runDepreciation, postDepreciation, cancelDepreciation, type ActionResult,
} from '@/app/actions/assets.ts';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function RunForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runDepreciation, null,
  );

  // الافتراض هو الشهر المنقضي: مسيّر الشهر الجاري يُولَّد بعد انتهائه.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  return (
    <div className="card">
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        {state && state.ok ? <div className="alert ok">{state.note}</div> : null}

        <form action={action} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <label htmlFor="month">الشهر</label>
            <select id="month" name="month" defaultValue={prev.getUTCMonth() + 1}>
              {MONTHS_AR.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, maxWidth: 120 }}>
            <label htmlFor="year">السنة</label>
            <input
              id="year" name="year" type="number" min={2000} max={2100}
              defaultValue={prev.getUTCFullYear()}
            />
          </div>
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? 'جارٍ…' : 'توليد المسيّر'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function RunActions({ runId, status }: { runId: string; status: string }) {
  const [postState, postAction, posting] = useActionState<ActionResult | null, FormData>(
    postDepreciation, null,
  );
  const [cancelState, cancelAction, cancelling] = useActionState<ActionResult | null, FormData>(
    cancelDepreciation, null,
  );

  if (status === 'CANCELLED') return null;

  const state = postState ?? cancelState;

  return (
    <>
      {status === 'DRAFT' ? (
        <form action={postAction} style={{ display: 'inline' }}>
          <input type="hidden" name="runId" value={runId} />
          <button className="btn sm primary" type="submit" disabled={posting}>
            {posting ? 'جارٍ…' : 'ترحيل'}
          </button>
        </form>
      ) : (
        // الملغى لا يُلغى، والمرحَّل يُلغى بقيدٍ عكسي لا بحذف — لأن الرقم
        // الذي رُحّل صار في الميزان، ومحوُه يترك فجوةً في التسلسل.
        <form action={cancelAction} style={{ display: 'inline' }}>
          <input type="hidden" name="runId" value={runId} />
          <button className="btn sm" type="submit" disabled={cancelling}>
            {cancelling ? 'جارٍ…' : 'إلغاء بقيد عكسي'}
          </button>
        </form>
      )}

      {state && !state.ok ? (
        <div className="small neg" style={{ marginTop: 4 }}>{state.error}</div>
      ) : null}
    </>
  );
}
