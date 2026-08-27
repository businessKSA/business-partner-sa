'use client';

import { useActionState } from 'react';
import { actionSaveEmployee, actionRunPayroll, actionArchiveEmployee } from '@/app/finance-actions';

export function EmployeeForm({ centers }: { centers: { key: string; label: string }[] }) {
  const [state, action, pending] = useActionState(actionSaveEmployee, {});
  return (
    <form className="card" action={action}>
      <h3 style={{ marginTop: 0 }}>موظف جديد</h3>
      <div className="grid c3">
        <div>
          <label htmlFor="nameAr">الاسم *</label>
          <input id="nameAr" name="nameAr" required />
        </div>
        <div>
          <label htmlFor="jobTitleAr">المسمى الوظيفي</label>
          <input id="jobTitleAr" name="jobTitleAr" />
        </div>
        <div>
          <label htmlFor="costCenter">القسم (مركز التكلفة)</label>
          <select id="costCenter" name="costCenter" defaultValue="SHARED">
            {centers.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nationalId">الهوية / الإقامة</label>
          <input id="nationalId" name="nationalId" dir="ltr" />
        </div>
        <div>
          <label htmlFor="iban">الآيبان</label>
          <input id="iban" name="iban" dir="ltr" placeholder="SA.." />
        </div>
        <div>
          <label htmlFor="basicSalary">الراتب الأساسي *</label>
          <input id="basicSalary" name="basicSalary" type="number" min="1" step="0.01" required dir="ltr" />
        </div>
        <div>
          <label htmlFor="allowances">البدلات</label>
          <input id="allowances" name="allowances" type="number" min="0" step="0.01" dir="ltr" defaultValue="0" />
        </div>
        <div>
          <label htmlFor="gosiEmployer">تأمينات — حصة المنشأة</label>
          <input id="gosiEmployer" name="gosiEmployer" type="number" min="0" step="0.01" dir="ltr" defaultValue="0" />
        </div>
        <div>
          <label htmlFor="gosiEmployee">تأمينات — حصة الموظف (تُخصم)</label>
          <input id="gosiEmployee" name="gosiEmployee" type="number" min="0" step="0.01" dir="ltr" defaultValue="0" />
        </div>
      </div>
      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 12 }}>{state.ok}</div> : null}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ الحفظ' : 'أضف الموظف'}
        </button>
      </div>
    </form>
  );
}

export function PayrollForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState(actionRunPayroll, {});
  return (
    <form className="card" action={action}>
      <h3 style={{ marginTop: 0 }}>تقييد مسير الرواتب</h3>
      <p className="sub">
        قيد واحد يولّد مصروف راتب لكل موظف نشط على مركز تكلفة قسمه —
        بكلفة المنشأة الكاملة (أساسي + بدلات + حصة المنشأة في التأمينات).
      </p>
      <div className="row" style={{ alignItems: 'end' }}>
        <div>
          <label htmlFor="month">الشهر</label>
          <input id="month" name="month" type="month" dir="ltr" defaultValue={defaultMonth} required />
        </div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ التقييد' : 'قيّد المسير'}
        </button>
      </div>
      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 12 }}>{state.ok}</div> : null}
    </form>
  );
}

export function ArchiveEmployeeButton({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={actionArchiveEmployee.bind(null, id)} style={{ display: 'inline' }}>
      <button className="btn ghost sm" type="submit">{active ? 'أرشفة' : 'تفعيل'}</button>
    </form>
  );
}
