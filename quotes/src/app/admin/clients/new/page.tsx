'use client';
import { useActionState } from 'react';
import { actionCreateClient } from '@/app/actions';

export default function NewClient() {
  const [state, action, pending] = useActionState(actionCreateClient, {});
  return (
    <>
      <h1>عميل جديد</h1>
      <p className="sub">عند الحفظ يُنشأ مجلد العميل تلقائياً بثلاثة مجلدات فرعية: عروض الأسعار · العقود · المرفقات.</p>
      <form className="card" action={action}>
        <div className="grid c2">
          <div>
            <label htmlFor="nameAr">اسم الشخص بالعربي *</label>
            <input id="nameAr" name="nameAr" required />
          </div>
          <div>
            <label htmlFor="nameEn">اسم الشخص بالإنجليزي</label>
            <input id="nameEn" name="nameEn" dir="ltr" />
          </div>
          <div>
            <label htmlFor="companyAr">اسم الشركة بالعربي</label>
            <input id="companyAr" name="companyAr" />
          </div>
          <div>
            <label htmlFor="companyEn">اسم الشركة بالإنجليزي</label>
            <input id="companyEn" name="companyEn" dir="ltr" />
          </div>
          <div>
            <label htmlFor="crNumber">السجل التجاري</label>
            <input id="crNumber" name="crNumber" dir="ltr" />
          </div>
          <div>
            <label htmlFor="vatNumber">الرقم الضريبي</label>
            <input id="vatNumber" name="vatNumber" dir="ltr" />
          </div>
          <div>
            <label htmlFor="email">البريد الإلكتروني *</label>
            <input id="email" name="email" type="email" required dir="ltr" />
          </div>
          <div>
            <label htmlFor="phone">جوال واتساب *</label>
            <input id="phone" name="phone" required dir="ltr" placeholder="0555123456 أو 966555123456" />
          </div>
          <div>
            <label htmlFor="country">الدولة</label>
            <input id="country" name="country" defaultValue="SA" dir="ltr" />
          </div>
          <div>
            <label htmlFor="city">المدينة</label>
            <input id="city" name="city" />
          </div>
          <div>
            <label htmlFor="addressAr">العنوان بالعربي</label>
            <input id="addressAr" name="addressAr" />
          </div>
          <div>
            <label htmlFor="addressEn">العنوان بالإنجليزي</label>
            <input id="addressEn" name="addressEn" dir="ltr" />
          </div>
          <div>
            <label htmlFor="repName">اسم الممثل (الموقّع عن العميل)</label>
            <input id="repName" name="repName" />
          </div>
          <div>
            <label htmlFor="repTitle">صفة الممثل</label>
            <input id="repTitle" name="repTitle" />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ' : 'حفظ العميل'}</button>
          <a className="btn ghost" href="/admin/clients">إلغاء</a>
        </div>
        {state.error ? <div className="notice bad">{state.error}</div> : null}
      </form>
    </>
  );
}
