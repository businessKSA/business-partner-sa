'use client';

import { useActionState, useState } from 'react';
import { saveExchangeRate, revalueCurrencies, type ActionResult } from '@/app/actions/treasury.ts';

export function RateForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveExchangeRate, null,
  );

  return (
    <div className="card">
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        {state && state.ok ? <div className="alert ok">حُفظ السعر.</div> : null}

        <form action={action} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 110 }}>
            <label htmlFor="currency">العملة</label>
            <input
              id="currency" name="currency" type="text" required
              maxLength={3} placeholder="USD" style={{ textTransform: 'uppercase' }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, maxWidth: 170 }}>
            <label htmlFor="date">التاريخ</label>
            <input id="date" name="date" type="date" required defaultValue={defaultDate} />
          </div>
          <div className="field" style={{ marginBottom: 0, maxWidth: 170 }}>
            <label htmlFor="rate">السعر</label>
            <input id="rate" name="rate" type="text" inputMode="decimal" required placeholder="3.75" />
          </div>
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? 'جارٍ…' : 'حفظ السعر'}
          </button>
        </form>
        <div className="small muted" style={{ marginTop: 8 }}>
          السعر يعني: كم وحدة من عملة الدفاتر تساوي وحدةً واحدة من هذه العملة.
          ويُقرأ عند التقييم آخرُ سعرٍ في التاريخ أو قبله — لا بعده.
        </div>
      </div>
    </div>
  );
}

export function RevalueForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    revalueCurrencies, null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <>
        <button className="btn sm primary" type="button" onClick={() => setOpen(true)}>
          ترحيل إعادة التقييم
        </button>
        {state && state.ok ? <span className="small pos" style={{ marginInlineStart: 8 }}>رُحّلت.</span> : null}
      </>
    );
  }

  return (
    <form action={action} style={{ minWidth: 280 }}>
      <input type="hidden" name="valuationDate" value={defaultDate} />

      <div className="field" style={{ marginBottom: 8 }}>
        {/* الحقل المخفي يجعل الإلغاء صريحاً: مربّعٌ غيرُ مؤشَّر لا يُرسَل. */}
        <input type="hidden" name="autoReverse" value="off" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="autoReverse" value="on" defaultChecked />
          <span className="small">عكس القيد في اليوم التالي</span>
        </label>
        <div className="help">
          العكس هو جوهر العملية لا زينةً فيها: الفرق غير محقَّق، وإبقاؤه يجعل
          الرصيد بعد أشهرٍ مجموعَ تقديراتٍ لا رصيداً يقابله شيء.
        </div>
      </div>

      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sm primary" type="submit" disabled={pending}>
          {pending ? 'جارٍ…' : `ترحيل بتاريخ ${defaultDate}`}
        </button>
        <button className="btn sm" type="button" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  );
}
