'use client';

import { useActionState, useState } from 'react';
import { postSalesInvoice, cancelSalesInvoice, submitToZatca } from '@/app/actions/sales.ts';
import type { ActionResult } from '@/app/actions/accounting.ts';

export function InvoiceActions({
  invoiceId, status, zatcaStatus, canPost, canCancel, canSubmit,
}: {
  invoiceId: string; status: string; zatcaStatus: string | null;
  canPost: boolean; canCancel: boolean; canSubmit: boolean;
}) {
  const [postState, postAction, posting] = useActionState<ActionResult | null, FormData>(postSalesInvoice, null);
  const [cancelState, cancelAction, cancelling] = useActionState<ActionResult | null, FormData>(cancelSalesInvoice, null);
  const [zatcaState, zatcaAction, submitting] = useActionState<ActionResult | null, FormData>(submitToZatca, null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const err = [postState, cancelState, zatcaState].find((s) => s && !s.ok);
  const sent = zatcaStatus && ['CLEARED', 'REPORTED', 'WARNING'].includes(zatcaStatus);

  return (
    <>
      {status === 'DRAFT' && canPost ? (
        <form action={postAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button className="btn primary sm" type="submit" disabled={posting}>
            {posting ? 'جارٍ الترحيل…' : 'ترحيل الفاتورة'}
          </button>
        </form>
      ) : null}

      {status !== 'DRAFT' && status !== 'CANCELLED' && canSubmit && !sent ? (
        <form action={zatcaAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button className="btn sm" type="submit" disabled={submitting}>
            {submitting ? 'جارٍ الإرسال…' : 'إرسال لهيئة الزكاة والضريبة'}
          </button>
        </form>
      ) : null}

      {status !== 'CANCELLED' && canCancel && !sent ? (
        confirmCancel ? (
          <form action={cancelAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input name="reason" type="text" placeholder="سبب الإلغاء" style={{ width: 190 }} />
            <button className="btn danger sm" type="submit" disabled={cancelling}>تأكيد</button>
            <button className="btn sm" type="button" onClick={() => setConfirmCancel(false)}>تراجع</button>
          </form>
        ) : (
          <button className="btn danger sm" type="button" onClick={() => setConfirmCancel(true)}>
            إلغاء الفاتورة
          </button>
        )
      ) : null}

      {err && !err.ok ? (
        <div className="alert error" style={{ margin: 0, flexBasis: '100%' }}>{err.error}</div>
      ) : null}
    </>
  );
}
