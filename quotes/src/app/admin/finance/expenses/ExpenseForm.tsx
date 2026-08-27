'use client';

import { useActionState } from 'react';
import { actionCreateExpense } from '@/app/finance-actions';

export function ExpenseForm({
  centers,
  categories,
  methods,
}: {
  centers: { key: string; label: string }[];
  categories: { key: string; label: string }[];
  methods: { key: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(actionCreateExpense, {});
  return (
    <form className="card" action={action}>
      <div className="grid c3">
        <div>
          <label htmlFor="date">التاريخ</label>
          <input id="date" name="date" type="date" dir="ltr" />
        </div>
        <div>
          <label htmlFor="category">التصنيف</label>
          <select id="category" name="category" defaultValue="OTHER">
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="costCenter">مركز التكلفة (القسم)</label>
          <select id="costCenter" name="costCenter" defaultValue="GENERAL">
            {centers.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vendorName">المورّد / الجهة *</label>
          <input id="vendorName" name="vendorName" required />
        </div>
        <div>
          <label htmlFor="vendorVat">الرقم الضريبي للمورّد</label>
          <input id="vendorVat" name="vendorVat" dir="ltr" placeholder="3xxxxxxxxxxxxx3" />
        </div>
        <div>
          <label htmlFor="method">طريقة الدفع</label>
          <select id="method" name="method" defaultValue="TRANSFER">
            {methods.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
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
          <label htmlFor="vatAmount">ضريبة القيمة المضافة المدفوعة</label>
          <input id="vatAmount" name="vatAmount" type="number" min="0" step="0.01" dir="ltr" defaultValue="0" />
        </div>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        ضريبة المدخلات تُخصم من إقرارك فقط إذا سجّلت الرقم الضريبي للمورّد —
        بلا رقم ضريبي تُعامل الضريبة المدفوعة كتكلفة لا كخصم.
      </div>

      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ القيد' : 'قيّد المصروف'}
        </button>
      </div>
    </form>
  );
}
