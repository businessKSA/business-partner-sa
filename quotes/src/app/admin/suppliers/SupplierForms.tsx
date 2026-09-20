'use client';
import { useActionState } from 'react';
import { actionCreateSupplier, actionCreateSupplyRequest, actionSyncSuppliers } from '@/app/actions';
import { SUPPLIER_CATEGORIES } from '@/lib/categories';

export default function SupplierForms({
  clients,
  preselectedClient,
}: {
  clients: { id: string; label: string }[];
  preselectedClient: string;
}) {
  const [sup, supAction, supPending] = useActionState(actionCreateSupplier, {});
  const [req, reqAction, reqPending] = useActionState(actionCreateSupplyRequest, {});
  const [syn, synAction, synPending] = useActionState(actionSyncSuppliers, {});

  return (
    <>
    <form className="card" action={synAction} style={{ marginBottom: 14 }}>
      <h2>سحب الموردين من نوشن</h2>
      <p className="sub">
        نوشن مصدر الحقيقة لبيانات الموردين واتفاقياتهم. وهذا السحب ينسخ منها ما تحتاجه
        اللوحة وحده — الاسم والبريد والتصنيف والمدينة — ولا يحذف مورداً غاب عن نوشن،
        بل يعطّل من وُسم فيها «موقوف».
      </p>
      <label htmlFor="databaseId">معرّف قاعدة نوشن (فارغ = المضبوطة في البيئة)</label>
      <input id="databaseId" name="databaseId" dir="ltr" placeholder="6de1ba8b56cc458eaede603f734eb4ae" />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={synPending}>
          {synPending ? 'جارٍ السحب' : 'اسحب الآن'}
        </button>
      </div>
      {syn.error ? <div className="notice bad">{syn.error}</div> : null}
      {syn.ok ? <div className="notice ok">{syn.ok}</div> : null}
    </form>

    <div className="grid c2">
      <form className="card" action={supAction}>
        <h2>تسجيل مورد</h2>
        <div className="grid c2">
          <div><label htmlFor="s_nameAr">الاسم بالعربي *</label><input id="s_nameAr" name="nameAr" required /></div>
          <div><label htmlFor="s_nameEn">الاسم بالإنجليزي</label><input id="s_nameEn" name="nameEn" dir="ltr" /></div>
          <div><label htmlFor="s_cr">السجل التجاري</label><input id="s_cr" name="crNumber" dir="ltr" /></div>
          <div><label htmlFor="s_act">النشاط</label><input id="s_act" name="activityAr" placeholder="تجهيزات، ديكور، مقاولات…" /></div>
          <div><label htmlFor="s_bank">المصرف</label><input id="s_bank" name="bankName" /></div>
          <div><label htmlFor="s_iban">الآيبان</label><input id="s_iban" name="iban" dir="ltr" /></div>
          <div><label htmlFor="s_email">البريد</label><input id="s_email" name="email" type="email" dir="ltr" /></div>
          <div><label htmlFor="s_phone">الجوال</label><input id="s_phone" name="phone" dir="ltr" /></div>
          <div><label htmlFor="s_city">المدينة</label><input id="s_city" name="city" placeholder="الرياض" /></div>
        </div>

        {/* التصنيف صناديق اختيار لا نصّ حرّ: الطلب يمضي إلى من تُطابق فئتُه
            فئةَ الخدمة، ومن كتب فئته بحرفٍ مختلف لا يصله شيء ولا يعرف لماذا. */}
        <label style={{ marginTop: 10 }}>التصنيفات — إليها تُوجَّه طلبات العروض</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(SUPPLIER_CATEGORIES).map(([c, label]) => (
            <label key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
              <input type="checkbox" name="categories" value={c} style={{ width: 'auto' }} />
              {label}
            </label>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          بلا بريد لا يصل المورد طلب عرض — الإرسال بريدٌ لا مكالمة.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={supPending}>{supPending ? 'جارٍ الحفظ' : 'تسجيل المورد'}</button>
        </div>
        {sup.error ? <div className="notice bad">{sup.error}</div> : null}
        {sup.ok ? <div className="notice ok">{sup.ok}</div> : null}
      </form>

      <form className="card" action={reqAction}>
        <h2>طلب توريد جديد</h2>
        <label htmlFor="r_client">العميل *</label>
        <select id="r_client" name="clientId" required defaultValue={preselectedClient}>
          <option value="">— اختر عميلاً —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="grid c2">
          <div><label htmlFor="r_titleAr">العنوان بالعربي *</label><input id="r_titleAr" name="titleAr" required /></div>
          <div><label htmlFor="r_titleEn">العنوان بالإنجليزي *</label><input id="r_titleEn" name="titleEn" required dir="ltr" /></div>
        </div>
        <label htmlFor="r_scopeAr">النطاق بالعربي</label>
        <textarea id="r_scopeAr" name="scopeAr" />
        <label htmlFor="r_scopeEn">النطاق بالإنجليزي</label>
        <textarea id="r_scopeEn" name="scopeEn" dir="ltr" />
        <label htmlFor="r_fee">أتعاب التنسيق (ريال، غير شامل الضريبة)</label>
        <input id="r_fee" name="coordinationFee" type="number" step="0.01" min="0" defaultValue={0} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={reqPending}>{reqPending ? 'جارٍ الإنشاء' : 'إنشاء طلب التوريد'}</button>
        </div>
        {req.error ? <div className="notice bad">{req.error}</div> : null}
      </form>
    </div>
    </>
  );
}
