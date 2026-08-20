'use client';
import { useActionState } from 'react';
import { actionRunAgent } from '@/app/actions';

export default function AgentForm({
  clients,
  preselected,
  ready,
}: {
  clients: { id: string; label: string }[];
  preselected: string;
  ready: boolean;
}) {
  const [state, action, pending] = useActionState(actionRunAgent, {});
  return (
    <form className="card" action={action}>
      <div className="grid c2">
        <div>
          <label htmlFor="clientId">العميل *</label>
          <select id="clientId" name="clientId" required defaultValue={preselected}>
            <option value="">— اختر عميلاً —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="qty">الكمية</label>
          <input id="qty" name="qty" type="number" min="1" defaultValue={1} />
        </div>
        <div>
          <label htmlFor="nameAr">اسم الخدمة بالعربي *</label>
          <input id="nameAr" name="nameAr" required />
        </div>
        <div>
          <label htmlFor="nameEn">اسم الخدمة بالإنجليزي *</label>
          <input id="nameEn" name="nameEn" required dir="ltr" />
        </div>
        <div>
          <label htmlFor="summaryAr">وصف موجز بالعربي *</label>
          <textarea id="summaryAr" name="summaryAr" required />
        </div>
        <div>
          <label htmlFor="summaryEn">وصف موجز بالإنجليزي (اختياري)</label>
          <textarea id="summaryEn" name="summaryEn" dir="ltr" />
        </div>
        <div>
          <label htmlFor="price">السعر (ريال، غير شامل الضريبة) *</label>
          <input id="price" name="price" type="number" step="0.01" min="0" required />
        </div>
        <div>
          <label htmlFor="paymentTermsAr">طريقة الدفع بالعربي *</label>
          <input id="paymentTermsAr" name="paymentTermsAr" required placeholder="كامل المبلغ مقدماً" />
        </div>
        <div>
          <label htmlFor="paymentTermsEn">طريقة الدفع بالإنجليزي</label>
          <input id="paymentTermsEn" name="paymentTermsEn" dir="ltr" placeholder="Full amount in advance" />
        </div>
        <div>
          <label htmlFor="deliveryAr">مدة التنفيذ بالعربي *</label>
          <input id="deliveryAr" name="deliveryAr" required placeholder="10 أيام عمل" />
        </div>
        <div>
          <label htmlFor="deliveryEn">مدة التنفيذ بالإنجليزي</label>
          <input id="deliveryEn" name="deliveryEn" dir="ltr" placeholder="10 working days" />
        </div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={pending || !ready}>
          {pending ? 'جارٍ التوليد…' : 'توليد العرض والعقد كمسودتين'}
        </button>
      </div>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
    </form>
  );
}
