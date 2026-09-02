'use client';

import { useActionState, useState } from 'react';
import { setTenantStatus, deleteTenant } from '@/app/actions/platform.ts';
import type { ActionResult } from '@/app/actions/accounting.ts';
import { Status } from '@/components/ui.tsx';

export function TenantRow({
  tenant,
}: {
  tenant: {
    id: string; slug: string; nameAr: string; vatNumber: string | null;
    status: string; createdAt: string; planName: string | null;
    users: number; invoices: number; employees: number;
  };
}) {
  const [statusState, statusAction, statusPending] =
    useActionState<ActionResult | null, FormData>(setTenantStatus, null);
  const [delState, delAction, delPending] =
    useActionState<ActionResult | null, FormData>(deleteTenant, null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const err = [statusState, delState].find((s) => s && !s.ok);

  return (
    <>
      <tr data-tenant-slug={tenant.slug}>
        <td className="mono small">{tenant.slug}</td>
        <td>{tenant.nameAr}</td>
        <td className="mono small">{tenant.vatNumber ?? <span className="muted">—</span>}</td>
        <td className="small">{tenant.planName ?? <span className="muted">بلا باقة</span>}</td>
        <td className="num">{tenant.users}</td>
        <td className="num">{tenant.invoices}</td>
        <td className="num">{tenant.employees}</td>
        <td className="num small">{tenant.createdAt}</td>
        <td><Status value={tenant.status} /></td>
        <td>
          <div className="actions">
            <form action={statusAction} style={{ display: 'flex', gap: 4 }}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <select name="status" defaultValue={tenant.status} style={{ width: 120 }}>
                <option value="TRIAL">تجريبي</option>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="CANCELLED">ملغى</option>
              </select>
              <button className="btn sm" type="submit" disabled={statusPending}>حفظ</button>
            </form>

            {confirmDelete ? (
              <form action={delAction} style={{ display: 'flex', gap: 4 }}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input name="confirmSlug" placeholder={tenant.slug} style={{ width: 130 }} />
                <button className="btn danger sm" type="submit" disabled={delPending}>حذف نهائي</button>
                <button className="btn sm" type="button" onClick={() => setConfirmDelete(false)}>تراجع</button>
              </form>
            ) : (
              <button className="btn sm delete-tenant" type="button" onClick={() => setConfirmDelete(true)}>حذف</button>
            )}
          </div>
        </td>
      </tr>

      {err && !err.ok ? (
        <tr><td colSpan={10}><div className="alert error" style={{ margin: 0 }}>{err.error}</div></td></tr>
      ) : null}
      {confirmDelete ? (
        <tr>
          <td colSpan={10} className="small muted">
            الحذف يمحو كل دفاتر «{tenant.nameAr}» ولا رجعة فيه. اكتب
            <span className="mono"> {tenant.slug} </span> للتأكيد.
          </td>
        </tr>
      ) : null}
    </>
  );
}
