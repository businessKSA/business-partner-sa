'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { actionUpdateOwnProfile } from '@/app/actions';
import PhoneField from '@/components/PhoneField';

export interface OwnProfile {
  nameAr: string;
  nameEn: string | null;
  companyAr: string | null;
  companyEn: string | null;
  crNumber: string | null;
  vatNumber: string | null;
  email: string;
  phone: string;
  city: string | null;
  addressAr: string | null;
  addressEn: string | null;
  repName: string | null;
  repTitle: string | null;
}

export default function ProfileForm({ profile }: { profile: OwnProfile }) {
  const [state, action, pending] = useActionState(actionUpdateOwnProfile, {});
  const v = (x: string | null) => x ?? '';
  return (
    <form className="card" action={action}>
      <div className="grid c2">
        <div>
          <label htmlFor="companyAr">اسم المنشأة بالعربي</label>
          <input id="companyAr" name="companyAr" defaultValue={v(profile.companyAr)} />
        </div>
        <div>
          <label htmlFor="companyEn">اسم المنشأة بالإنجليزي</label>
          <input id="companyEn" name="companyEn" dir="ltr" defaultValue={v(profile.companyEn)} />
        </div>
        <div>
          <label htmlFor="crNumber">رقم السجل التجاري</label>
          <input id="crNumber" name="crNumber" dir="ltr" defaultValue={v(profile.crNumber)} />
        </div>
        <div>
          <label htmlFor="vatNumber">الرقم الضريبي</label>
          <input id="vatNumber" name="vatNumber" dir="ltr" defaultValue={v(profile.vatNumber)} />
        </div>
        <div>
          <label htmlFor="nameAr">اسم مسؤول التواصل بالعربي *</label>
          <input id="nameAr" name="nameAr" required defaultValue={profile.nameAr} />
        </div>
        <div>
          <label htmlFor="nameEn">اسم مسؤول التواصل بالإنجليزي</label>
          <input id="nameEn" name="nameEn" dir="ltr" defaultValue={v(profile.nameEn)} />
        </div>
        <PhoneField name="phone" required defaultValue={profile.phone} />
        <div>
          <label htmlFor="city">المدينة</label>
          <input id="city" name="city" defaultValue={v(profile.city)} />
        </div>
        <div>
          <label htmlFor="addressAr">العنوان الوطني بالعربي</label>
          <input id="addressAr" name="addressAr" defaultValue={v(profile.addressAr)} />
        </div>
        <div>
          <label htmlFor="addressEn">العنوان بالإنجليزي</label>
          <input id="addressEn" name="addressEn" dir="ltr" defaultValue={v(profile.addressEn)} />
        </div>
        <div>
          <label htmlFor="repName">اسم من يوقّع العقود عن المنشأة</label>
          <input id="repName" name="repName" defaultValue={v(profile.repName)} />
        </div>
        <div>
          <label htmlFor="repTitle">صفته</label>
          <input id="repTitle" name="repTitle" defaultValue={v(profile.repTitle)} />
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ' : 'حفظ بياناتي'}</button>
        <Link className="btn ghost" href="/portal">رجوع</Link>
      </div>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
      {state.ok ? <div className="notice good">{state.ok}</div> : null}
    </form>
  );
}
