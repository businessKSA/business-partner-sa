'use client';

import { useActionState } from 'react';
import { actionCreateRevenue } from '@/app/finance-actions';

export function RevenueForm({
  centers,
  methods,
}: {
  centers: { key: string; label: string }[];
  methods: { key: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(actionCreateRevenue, {});
  return (
    <form className="card" action={action}>
      <div className="grid c3">
        <div>
          <label htmlFor="date">التاريخ</label>
          <input id="date" name="date" type="date" dir="ltr" />
        </div>
        <div>
          <label htmlFor="source">المصدر *</label>
          <input id="source" name="source" required placeholder="مثال: تحصيل نقدي — خدمة قوى" />
        </div>
        <div>
          <label htmlFor="costCenter">القسم</label>
          <select id="costCenter" name="costCenter" defaultValue="SALES">
            {centers.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="descAr">الوصف *</label>
          <input id="descAr" name="descAr" required />
        </div>
        <div>
          <label htmlFor="amountExclVat">المبلغ غير شامل الضريبة *</label>
          <input id="amountExclVat" name="amountExclVat" type="number" min="0.01" step="0.01" required dir="ltr" />
        </div>
        <div>
          <label htmlFor="vatAmount">ضريبة القيمة المضافة المحصّلة</label>
          <input id="vatAmount" name="vatAmount" type="number" min="0" step="0.01" dir="ltr" defaultValue="0" />
        </div>
        <div>
          <label htmlFor="method">طريقة التحصيل</label>
          <select id="method" name="method" defaultValue="TRANSFER">
            {methods.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        هذه القيود لما يقع خارج فواتير اللوحة فقط — الفواتير المدفوعة تدخل الإيراد
        آلياً ولا تُقيَّد هنا مرة ثانية.
      </div>

      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ القيد' : 'قيّد الإيراد'}
        </button>
      </div>
    </form>
  );
}
