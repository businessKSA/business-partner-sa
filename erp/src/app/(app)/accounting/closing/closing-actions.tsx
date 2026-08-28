'use client';

import { useActionState, useState } from 'react';
import { closeYear, undoClosing, type ActionResult } from '@/app/actions/treasury.ts';

export function CloseYearForm({
  fiscalYearId, yearName, blocked,
}: { fiscalYearId: string; yearName: string; blocked: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(closeYear, null);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>إقفال السنة {yearName}</h2>
          <div className="hint">
            يُرحَّل قيدٌ واحد يصفّر كل حساب مؤقّت وينقل الصافي إلى الأرباح المُبقاة.
          </div>
        </div>
      </div>
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        {state && state.ok ? <div className="alert ok">{state.note}</div> : null}

        <form action={action}>
          <input type="hidden" name="fiscalYearId" value={fiscalYearId} />

          <div className="field">
            <label htmlFor="note">ملاحظة الإقفال</label>
            <input id="note" name="note" type="text" placeholder="اختيارية — تُقرأ في التدقيق" />
          </div>

          <div className="field">
            <label htmlFor="lockPeriods" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input id="lockPeriods" name="lockPeriods" type="checkbox" defaultChecked />
              <span>قفل فترات السنة نهائياً</span>
            </label>
            <div className="help">
              القفل النهائي يمنع أي قيدٍ لاحق بتاريخ السنة. وهذا هو المقصود من
              الإقفال: أن رقماً أُقرَّ لا يتغيّر من خلفه.
            </div>
          </div>

          <div className="field">
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="small">
                أُقرّ بأنني راجعت قائمة الدخل والمركز المالي للسنة {yearName}، وأن
                الرجوع عن الإقفال — وإن كان ممكناً — يُسجَّل ويظهر للمدقّق.
              </span>
            </label>
          </div>

          <button className="btn primary" type="submit" disabled={pending || blocked || !confirmed}>
            {pending ? 'جارٍ الإقفال…' : `إقفال السنة ${yearName}`}
          </button>
          {blocked ? (
            <span className="small neg" style={{ marginInlineStart: 10 }}>
              رحّل القيود المسوّدة أوّلاً.
            </span>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function UndoClosing({ fiscalYearId }: { fiscalYearId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(undoClosing, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div style={{ marginTop: 10 }}>
        <button className="btn sm" type="button" onClick={() => setOpen(true)}>
          الرجوع عن الإقفال
        </button>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 10 }}>
      <input type="hidden" name="fiscalYearId" value={fiscalYearId} />
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="reason">سبب الرجوع</label>
        <input id="reason" name="reason" type="text" required placeholder="يُسجَّل ويظهر للمدقّق" />
      </div>
      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sm primary" type="submit" disabled={pending}>
          {pending ? 'جارٍ…' : 'تأكيد الرجوع'}
        </button>
        <button className="btn sm" type="button" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  );
}
