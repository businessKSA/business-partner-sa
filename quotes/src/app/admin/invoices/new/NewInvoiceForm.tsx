'use client';
import Link from 'next/link';

import { useActionState } from 'react';
import { actionCreateInvoice } from '@/app/actions';

export function NewInvoiceForm({ clients }: { clients: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(actionCreateInvoice, {});
  return (
    <form className="card" action={action}>
      <div className="grid c2">
        <div>
          <label htmlFor="clientId">العميل *</label>
          <select id="clientId" name="clientId" required defaultValue="">
            <option value="" disabled>— اختر عميلاً —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="amountExclVat">المبلغ غير شامل الضريبة *</label>
          <input id="amountExclVat" name="amountExclVat" type="number" min="1" step="0.01" required dir="ltr" />
        </div>
        <div>
          <label htmlFor="titleAr">وصف الفاتورة بالعربي *</label>
          <input id="titleAr" name="titleAr" required />
        </div>
        <div>
          <label htmlFor="titleEn">وصف الفاتورة بالإنجليزي</label>
          <input id="titleEn" name="titleEn" dir="ltr" />
        </div>
        <div>
          <label htmlFor="dueDate">تاريخ الاستحقاق</label>
          <input id="dueDate" name="dueDate" type="date" dir="ltr" />
        </div>
        <div>
          <label htmlFor="depositKind">نوع المبلغ</label>
          <select id="depositKind" name="depositKind" defaultValue="">
            <option value="">أتعاب — تُحتسب عليها ضريبة القيمة المضافة</option>
            <option value="GOV_FEE">عهدة رسوم حكومية — بلا ضريبة</option>
            <option value="SUPPLY">عهدة توريد — بلا ضريبة</option>
          </select>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        الأتعاب تُضاف عليها ضريبة القيمة المضافة خمسة عشر بالمئة في سطر مستقل.
        العهدة إيداع في محفظة العميل يُصرف للجهات أو للموردين بإيصالاته، فلا تُحتسب عليه ضريبة ولا يدخل الإيراد.
      </div>

      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ الإصدار' : 'أصدر الفاتورة'}
        </button>
        <Link className="btn ghost" href="/admin/invoices">إلغاء</Link>
      </div>
    </form>
  );
}
