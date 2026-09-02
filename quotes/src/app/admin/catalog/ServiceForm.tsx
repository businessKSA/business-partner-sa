'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { actionSaveService } from '@/app/actions';
import { SUPPLIER_CATEGORIES } from '@/lib/categories';

type S = {
  id: string;
  code: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  unitPrice: number;
  unitAr: string;
  unitEn: string;
  minQty: number;
  openPrice: boolean;
  paymentTermsAr: string;
  paymentTermsEn: string;
  deliveryAr: string;
  deliveryEn: string;
  attachGovFees: boolean;
  sourcingCategory: string | null;
  validityDays: number | null;
  active: boolean;
  paymentMethods: string;
  notionPageId: string | null;
  siteSlug: string | null;
  govPlatform: string | null;
};

export default function ServiceForm({ service }: { service: S | null }) {
  const [state, action, pending] = useActionState(actionSaveService, {});
  const v = service;
  return (
    <form className="card" action={action} key={v?.id ?? 'new'}>
      <h2>{v ? `تعديل الخدمة ${v.code}` : 'إضافة خدمة جديدة'}</h2>
      {v ? <input type="hidden" name="id" value={v.id} /> : null}
      <div className="grid c4">
        <div>
          <label htmlFor="code">الكود</label>
          <input id="code" name="code" defaultValue={v?.code} required dir="ltr" placeholder="FI-100" />
        </div>
        <div>
          <label htmlFor="category">التصنيف</label>
          <input id="category" name="category" defaultValue={v?.category ?? 'general'} dir="ltr" />
        </div>
        <div>
          <label htmlFor="unitPrice">سعر الوحدة (ريال، غير شامل الضريبة)</label>
          <input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" defaultValue={v?.unitPrice ?? 0} />
        </div>
        <div>
          <label htmlFor="minQty">الحد الأدنى للكمية</label>
          <input id="minQty" name="minQty" type="number" min="1" defaultValue={v?.minQty ?? 1} />
        </div>
      </div>
      <div className="grid c2">
        <div>
          <label htmlFor="nameAr">الاسم بالعربي</label>
          <input id="nameAr" name="nameAr" defaultValue={v?.nameAr} required />
        </div>
        <div>
          <label htmlFor="nameEn">الاسم بالإنجليزي</label>
          <input id="nameEn" name="nameEn" defaultValue={v?.nameEn} required dir="ltr" />
        </div>
        <div>
          <label htmlFor="descAr">الوصف بالعربي</label>
          <textarea id="descAr" name="descAr" defaultValue={v?.descAr ?? ''} />
        </div>
        <div>
          <label htmlFor="descEn">الوصف بالإنجليزي</label>
          <textarea id="descEn" name="descEn" defaultValue={v?.descEn ?? ''} dir="ltr" />
        </div>
        <div>
          <label htmlFor="paymentTermsAr">شروط الدفع بالعربي</label>
          <input id="paymentTermsAr" name="paymentTermsAr" defaultValue={v?.paymentTermsAr} />
        </div>
        <div>
          <label htmlFor="paymentTermsEn">شروط الدفع بالإنجليزي</label>
          <input id="paymentTermsEn" name="paymentTermsEn" defaultValue={v?.paymentTermsEn} dir="ltr" />
        </div>
        <div>
          <label htmlFor="deliveryAr">مدة التنفيذ بالعربي</label>
          <input id="deliveryAr" name="deliveryAr" defaultValue={v?.deliveryAr} />
        </div>
        <div>
          <label htmlFor="deliveryEn">مدة التنفيذ بالإنجليزي</label>
          <input id="deliveryEn" name="deliveryEn" defaultValue={v?.deliveryEn} dir="ltr" />
        </div>
        <div>
          <label htmlFor="unitAr">وحدة التسعير بالعربي</label>
          <input id="unitAr" name="unitAr" defaultValue={v?.unitAr ?? 'خدمة'} />
        </div>
        <div>
          <label htmlFor="unitEn">وحدة التسعير بالإنجليزي</label>
          <input id="unitEn" name="unitEn" defaultValue={v?.unitEn ?? 'service'} dir="ltr" />
        </div>
        <div>
          <label htmlFor="sourcingCategory">تُنفَّذ عبر موردي فئة (فارغ = ننفّذها نحن)</label>
          <select id="sourcingCategory" name="sourcingCategory" defaultValue={v?.sourcingCategory ?? ''}>
            <option value="">لا — خدمة من خدماتنا بسعر الكتالوج</option>
            {Object.entries(SUPPLIER_CATEGORIES).map(([c, label]) => (
              <option key={c} value={c}>{label}</option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: 12 }}>
            باختيار فئة يتحوّل طلب العميل لهذه الخدمة إلى طلب توريد: يكتب تفاصيله، ويمضي
            طلب العرض إلى موردي الفئة، ويُبنى عرضه باسمنا من العرض المختار.
          </p>
        </div>
        <div>
          <label htmlFor="validityDays">صلاحية العرض بالأيام (فارغ = 30)</label>
          <input id="validityDays" name="validityDays" type="number" min="1" defaultValue={v?.validityDays ?? ''} />
        </div>
        <div style={{ paddingTop: 24 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" name="openPrice" defaultChecked={v?.openPrice ?? false} style={{ width: 'auto' }} />
            سعر مفتوح يُدخل يدوياً عند إنشاء العرض
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" name="attachGovFees" defaultChecked={v?.attachGovFees ?? false} style={{ width: 'auto' }} />
            إرفاق جدول الرسوم الحكومية المقدّرة
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" name="active" defaultChecked={v?.active ?? true} style={{ width: 'auto' }} />
            مفعّلة
          </label>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>الربط والسداد</h3>
      <p className="sub">
        هذه الحقول تبني خريطة الكتالوج: من هنا يعرف النظام صفحة الخدمة على الموقع
        وصفّها في نوشن، وبأي وسيلة تُسدَّد.
      </p>
      <div className="grid c2">
        <div>
          <label htmlFor="siteSlug">مسار صفحة الخدمة على الموقع</label>
          <input id="siteSlug" name="siteSlug" defaultValue={v?.siteSlug ?? ''} dir="ltr" placeholder="/services/bp-ai-03" />
        </div>
        <div>
          <label htmlFor="notionPageId">معرّف صفحة الخدمة في نوشن</label>
          <input id="notionPageId" name="notionPageId" defaultValue={v?.notionPageId ?? ''} dir="ltr" placeholder="3a6d108dee5c81eda844ebc814a071af" />
        </div>
        <div>
          <label htmlFor="govPlatform">الجهة الحكومية</label>
          <input id="govPlatform" name="govPlatform" defaultValue={v?.govPlatform ?? ''} placeholder="قوى" />
        </div>
        <div>
          <label htmlFor="paymentMethods">وسائل السداد (فارغ = كل المفعّل)</label>
          <input
            id="paymentMethods"
            name="paymentMethods"
            defaultValue={v?.paymentMethods ?? ''}
            dir="ltr"
            placeholder="creditcard,stcpay,banktransfer"
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ' : 'حفظ'}</button>
        {v ? <Link className="btn ghost" href="/admin/catalog">إلغاء التعديل</Link> : null}
      </div>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
      {state.ok ? <div className="notice ok">{state.ok}</div> : null}
    </form>
  );
}
