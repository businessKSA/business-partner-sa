'use client';
import { useActionState } from 'react';
import { actionUpdateClient } from '@/app/actions';
import PhoneField from '@/components/PhoneField';
import { COUNTRIES } from '@/lib/countries';

export interface EditableClient {
  id: string;
  nameAr: string;
  nameEn: string | null;
  companyAr: string | null;
  companyEn: string | null;
  crNumber: string | null;
  vatNumber: string | null;
  email: string;
  phone: string;
  country: string;
  city: string | null;
  addressAr: string | null;
  addressEn: string | null;
  repName: string | null;
  repTitle: string | null;
  notes: string | null;
}

export default function EditClientForm({ client }: { client: EditableClient }) {
  const [state, action, pending] = useActionState(actionUpdateClient, {});
  const v = (x: string | null) => x ?? '';
  return (
    <form className="card" action={action}>
      <input type="hidden" name="id" value={client.id} />
      <div className="grid c2">
        <div>
          <label htmlFor="nameAr">اسم الشخص بالعربي *</label>
          <input id="nameAr" name="nameAr" required defaultValue={client.nameAr} />
        </div>
        <div>
          <label htmlFor="nameEn">اسم الشخص بالإنجليزي</label>
          <input id="nameEn" name="nameEn" dir="ltr" defaultValue={v(client.nameEn)} />
        </div>
        <div>
          <label htmlFor="companyAr">اسم الشركة بالعربي</label>
          <input id="companyAr" name="companyAr" defaultValue={v(client.companyAr)} />
        </div>
        <div>
          <label htmlFor="companyEn">اسم الشركة بالإنجليزي</label>
          <input id="companyEn" name="companyEn" dir="ltr" defaultValue={v(client.companyEn)} />
        </div>
        <div>
          <label htmlFor="crNumber">السجل التجاري</label>
          <input id="crNumber" name="crNumber" dir="ltr" defaultValue={v(client.crNumber)} />
        </div>
        <div>
          <label htmlFor="vatNumber">الرقم الضريبي</label>
          <input id="vatNumber" name="vatNumber" dir="ltr" defaultValue={v(client.vatNumber)} />
        </div>
        <div>
          <label htmlFor="email">البريد الإلكتروني *</label>
          <input id="email" name="email" type="email" required dir="ltr" defaultValue={client.email} />
        </div>
        <PhoneField name="phone" required defaultValue={client.phone} />
        <div>
          <label htmlFor="country">الدولة</label>
          <select id="country" name="country" defaultValue={client.country}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="city">المدينة</label>
          <input id="city" name="city" defaultValue={v(client.city)} />
        </div>
        <div>
          <label htmlFor="addressAr">العنوان بالعربي</label>
          <input id="addressAr" name="addressAr" defaultValue={v(client.addressAr)} />
        </div>
        <div>
          <label htmlFor="addressEn">العنوان بالإنجليزي</label>
          <input id="addressEn" name="addressEn" dir="ltr" defaultValue={v(client.addressEn)} />
        </div>
        <div>
          <label htmlFor="repName">اسم الممثل (الموقّع عن العميل)</label>
          <input id="repName" name="repName" defaultValue={v(client.repName)} />
        </div>
        <div>
          <label htmlFor="repTitle">صفة الممثل</label>
          <input id="repTitle" name="repTitle" defaultValue={v(client.repTitle)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="notes">ملاحظات داخلية</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={v(client.notes)} />
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ' : 'حفظ التعديلات'}</button>
        <a className="btn ghost" href={`/admin/clients/${client.id}`}>إلغاء</a>
      </div>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
    </form>
  );
}
