'use client';

import { useActionState, useState } from 'react';
import { actionIssueCreditNote } from '@/app/finance-actions';

export function CreditNoteForm({
  invoices,
}: {
  invoices: { id: string; label: string; remaining: number }[];
}) {
  const [state, action, pending] = useActionState(actionIssueCreditNote, {});
  const [selected, setSelected] = useState('');
  const remaining = invoices.find((i) => i.id === selected)?.remaining;

  return (
    <form className="card" action={action}>
      <h3 style={{ marginTop: 0 }}>إشعار دائن</h3>
      <p className="sub">
        الفاتورة الضريبية الصادرة لا تُعدَّل ولا تُلغى — تُصحَّح بإشعار دائن يشير
        إليها، وهو ما تشترطه اللائحة. يُصدر عند الاسترداد أو الإلغاء أو الخصم بعد البيع.
      </p>
      <div className="grid c3">
        <div>
          <label htmlFor="recordId">الفاتورة الأصل *</label>
          <select
            id="recordId"
            name="recordId"
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="" disabled>— اختر فاتورة —</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="amountExclVat">المبلغ المردود غير شامل الضريبة</label>
          <input
            id="amountExclVat"
            name="amountExclVat"
            type="number"
            min="0.01"
            step="0.01"
            dir="ltr"
            placeholder={remaining != null ? `المتبقي ${remaining.toFixed(2)} — اتركه فارغاً للرد الكامل` : 'اتركه فارغاً للرد الكامل'}
          />
        </div>
        <div>
          <label htmlFor="reason">سبب الإشعار *</label>
          <input id="reason" name="reason" required placeholder="مثال: إلغاء الخدمة واسترداد المبلغ" />
        </div>
      </div>

      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 12 }}>{state.ok}</div> : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ الإصدار' : 'أصدر الإشعار الدائن'}
        </button>
      </div>
    </form>
  );
}
