'use client';

import { useActionState } from 'react';
import { createTenant } from '@/app/actions/platform.ts';
import type { ActionResult } from '@/app/actions/accounting.ts';

export function NewTenantForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTenant, null);

  return (
    <form action={action}>
      {state && !state.ok ? <div className="alert error">{state.error}</div> : null}

      <div className="card">
        <div className="card-head"><h2>بيانات المنشأة</h2></div>
        <div className="card-body">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="slug">المعرّف في الرابط</label>
              <input id="slug" name="slug" required pattern="[a-z0-9\-]{3,40}"
                placeholder="al-ofoq" dir="ltr" style={{ textAlign: 'left' }} />
              <div className="help">حروف لاتينية صغيرة وأرقام وشرطة. لا يتغيّر بعد الإنشاء.</div>
            </div>
            <div className="field">
              <label htmlFor="nameAr">اسم المنشأة بالعربية</label>
              <input id="nameAr" name="nameAr" required placeholder="مؤسسة الأفق للمقاولات" />
            </div>
            <div className="field">
              <label htmlFor="nameEn">الاسم بالإنجليزية</label>
              <input id="nameEn" name="nameEn" dir="ltr" style={{ textAlign: 'left' }} />
            </div>
            <div className="field">
              <label htmlFor="city">المدينة</label>
              <input id="city" name="city" placeholder="الرياض" />
            </div>
            <div className="field">
              <label htmlFor="crNumber">السجل التجاري</label>
              <input id="crNumber" name="crNumber" dir="ltr" style={{ textAlign: 'left' }} />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">الرقم الضريبي</label>
              <input id="vatNumber" name="vatNumber" dir="ltr" style={{ textAlign: 'left' }}
                placeholder="٣١٠٠٠٠٠٠٠٠٠٠٠٠٣" />
              <div className="help">
                يُشترط للفوترة الإلكترونية. يُضاف لاحقاً من إعدادات المنشأة إن لم يتوفّر الآن.
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">بريد المنشأة</label>
              <input id="email" name="email" type="email" dir="ltr" style={{ textAlign: 'left' }} />
            </div>
            <div className="field">
              <label htmlFor="phone">الهاتف</label>
              <input id="phone" name="phone" dir="ltr" style={{ textAlign: 'left' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>مالك المنشأة</h2>
            <div className="hint">يدخل بهذا البريد وله كل الصلاحيات داخل منشأته وحدها.</div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div className="field">
              <label htmlFor="ownerName">الاسم</label>
              <input id="ownerName" name="ownerName" required />
            </div>
            <div className="field">
              <label htmlFor="ownerEmail">البريد الإلكتروني</label>
              <input id="ownerEmail" name="ownerEmail" type="email" required
                dir="ltr" style={{ textAlign: 'left' }} />
            </div>
            <div className="field">
              <label htmlFor="password">كلمة مرور مؤقتة</label>
              <input id="password" name="password" type="text" required minLength={8}
                dir="ltr" style={{ textAlign: 'left' }} />
              <div className="help">سلّمها للمالك ليغيّرها عند أول دخول.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'جارٍ التجهيز…' : 'إنشاء المنشأة'}
        </button>
        <span className="muted small">
          يُنشأ معها ٦٧ حساباً و١٢ فترة مالية و٥ رموز ضريبية و٦ أدوار ومستودع وحساب صندوق.
        </span>
      </div>
    </form>
  );
}
