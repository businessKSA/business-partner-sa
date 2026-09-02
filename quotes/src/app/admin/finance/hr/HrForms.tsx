'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { actionSaveEmployee, actionRunPayroll, actionArchiveEmployee } from '@/app/finance-actions';

export interface EmployeeDraft {
  id: string;
  nameAr: string;
  nameEn: string | null;
  nationalId: string | null;
  jobTitleAr: string | null;
  costCenter: string;
  iban: string | null;
  basicSalary: number;
  allowances: number;
  gosiEmployer: number;
  gosiEmployee: number;
}

/**
 * نموذج واحد للإضافة والتعديل. الموظف المُمرَّر يملأ الحقول ويحمل معرّفه في
 * حقل مخفي — بغيره كان الفعل يُنشئ دائماً، فلا سبيل لتصحيح راتب بعد زيادة.
 * المفتاح `key` يجبر React على إعادة بناء النموذج عند تبديل الموظف، وإلا
 * بقيت قيم السابق في الحقول.
 */
export function EmployeeForm({
  centers,
  employee = null,
}: {
  centers: { key: string; label: string }[];
  employee?: EmployeeDraft | null;
}) {
  const [state, action, pending] = useActionState(actionSaveEmployee, {});
  return (
    <form className="card" action={action} key={employee?.id ?? 'new'}>
      <h3 style={{ marginTop: 0 }}>
        {employee ? `تعديل بيانات ${employee.nameAr}` : 'موظف جديد'}
      </h3>
      {employee ? <input type="hidden" name="id" value={employee.id} /> : null}
      <div className="grid c3">
        <div>
          <label htmlFor="nameAr">الاسم *</label>
          <input id="nameAr" name="nameAr" required defaultValue={employee?.nameAr ?? ''} />
        </div>
        <div>
          <label htmlFor="jobTitleAr">المسمى الوظيفي</label>
          <input id="jobTitleAr" name="jobTitleAr" defaultValue={employee?.jobTitleAr ?? ''} />
        </div>
        <div>
          <label htmlFor="costCenter">القسم (مركز التكلفة)</label>
          <select id="costCenter" name="costCenter" defaultValue={employee?.costCenter ?? 'SHARED'}>
            {centers.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nationalId">الهوية / الإقامة</label>
          <input id="nationalId" name="nationalId" dir="ltr" defaultValue={employee?.nationalId ?? ''} />
        </div>
        <div>
          <label htmlFor="iban">الآيبان</label>
          <input id="iban" name="iban" dir="ltr" placeholder="SA.." defaultValue={employee?.iban ?? ''} />
        </div>
        <div>
          <label htmlFor="basicSalary">الراتب الأساسي *</label>
          <input id="basicSalary" name="basicSalary" type="number" min="1" step="0.01" required dir="ltr" defaultValue={employee?.basicSalary ?? ''} />
        </div>
        <div>
          <label htmlFor="allowances">البدلات</label>
          <input id="allowances" name="allowances" type="number" min="0" step="0.01" dir="ltr" defaultValue={employee?.allowances ?? 0} />
        </div>
        <div>
          <label htmlFor="gosiEmployer">تأمينات — حصة المنشأة</label>
          <input id="gosiEmployer" name="gosiEmployer" type="number" min="0" step="0.01" dir="ltr" defaultValue={employee?.gosiEmployer ?? 0} />
        </div>
        <div>
          <label htmlFor="gosiEmployee">تأمينات — حصة الموظف (تُخصم)</label>
          <input id="gosiEmployee" name="gosiEmployee" type="number" min="0" step="0.01" dir="ltr" defaultValue={employee?.gosiEmployee ?? 0} />
        </div>
      </div>
      {state.error ? <div className="notice bad" style={{ marginTop: 12 }}>{state.error}</div> : null}
      {state.ok ? <div className="notice ok" style={{ marginTop: 12 }}>{state.ok}</div> : null}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'جارٍ الحفظ' : employee ? 'احفظ التعديل' : 'أضف الموظف'}
        </button>
        {employee ? <Link className="btn ghost" href="/admin/finance/hr">إلغاء</Link> : null}
      </div>
      {employee ? (
        <div className="notice" style={{ marginTop: 12 }}>
          التعديل يسري على المسيّرات القادمة فقط — المسيّرات المقيَّدة سابقاً
          ومصاريفها لا تتغير، فهي سجل لما صُرف فعلاً.
        </div>
      ) : null}
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
