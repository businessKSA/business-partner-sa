'use client';

import { useActionState, useState } from 'react';
import { addAsset, disposeFixedAsset, type ActionResult } from '@/app/actions/assets.ts';

const today = () => new Date().toISOString().slice(0, 10);

export function NewAssetForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addAsset, null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('STRAIGHT_LINE');

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" type="button" onClick={() => setOpen(true)}>
          إضافة أصل
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>أصل جديد</h2>
          <div className="hint">
            تاريخ بدء التشغيل — لا تاريخ الشراء — هو الذي يبدأ منه الاستهلاك.
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" type="button" onClick={() => setOpen(false)}>إغلاق</button>
        </div>
      </div>
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        {state && state.ok ? <div className="alert ok">أُضيف الأصل.</div> : null}

        <form action={action}>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="nameAr">اسم الأصل</label>
              <input id="nameAr" name="nameAr" type="text" required maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="code">الرمز</label>
              <input id="code" name="code" type="text" placeholder="يُولَّد تلقائياً" />
            </div>
            <div className="field">
              <label htmlFor="categoryAr">الفئة</label>
              <input id="categoryAr" name="categoryAr" type="text" placeholder="سيارات، أجهزة…" />
            </div>

            <div className="field">
              <label htmlFor="purchaseDate">تاريخ الشراء</label>
              <input id="purchaseDate" name="purchaseDate" type="date" required defaultValue={today()} />
            </div>
            <div className="field">
              <label htmlFor="inServiceDate">تاريخ بدء التشغيل</label>
              <input id="inServiceDate" name="inServiceDate" type="date" />
              <div className="help">يُترك فارغاً فيساوي تاريخ الشراء.</div>
            </div>
            <div className="field">
              <label htmlFor="serialNumber">الرقم التسلسلي</label>
              <input id="serialNumber" name="serialNumber" type="text" />
            </div>

            <div className="field">
              <label htmlFor="cost">التكلفة (بلا ضريبة)</label>
              <input id="cost" name="cost" type="text" inputMode="decimal" required placeholder="0.00" />
            </div>
            <div className="field">
              <label htmlFor="salvageValue">القيمة التخريدية</label>
              <input id="salvageValue" name="salvageValue" type="text" inputMode="decimal" defaultValue="0" />
              <div className="help">لا يُستهلك الأصل تحتها.</div>
            </div>
            <div className="field">
              <label htmlFor="usefulLifeMonths">العمر الإنتاجي (شهراً)</label>
              <input
                id="usefulLifeMonths" name="usefulLifeMonths" type="number"
                min={1} max={1200} required defaultValue={60}
              />
            </div>

            <div className="field">
              <label htmlFor="method">طريقة الاستهلاك</label>
              <select
                id="method" name="method" value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="STRAIGHT_LINE">القسط الثابت</option>
                <option value="DECLINING_BALANCE">القسط المتناقص</option>
                <option value="UNITS_OF_PRODUCTION">وحدات الإنتاج</option>
              </select>
            </div>

            {method === 'DECLINING_BALANCE' ? (
              <div className="field">
                <label htmlFor="decliningFactor">معامل التناقص</label>
                <input
                  id="decliningFactor" name="decliningFactor" type="text"
                  inputMode="decimal" defaultValue="2"
                />
                <div className="help">٢ تعني القسط المتناقص المضاعف.</div>
              </div>
            ) : null}

            {method === 'UNITS_OF_PRODUCTION' ? (
              <div className="field">
                <label htmlFor="totalUnits">إجمالي الوحدات المتوقَّعة</label>
                <input id="totalUnits" name="totalUnits" type="text" inputMode="decimal" />
                <div className="help">القسط يُحسب بوحدات الشهر لا بمرور الوقت.</div>
              </div>
            ) : null}
          </div>

          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? 'جارٍ…' : 'إضافة الأصل'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function DisposeAsset({
  assetId, nameAr, bookValue, accounts,
}: {
  assetId: string;
  nameAr: string;
  bookValue: string;
  accounts: { id: string; code: string; nameAr: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    disposeFixedAsset, null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn sm" type="button" onClick={() => setOpen(true)}>استبعاد</button>
    );
  }

  return (
    <form
      action={action}
      style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
        minWidth: 240,
      }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <div className="small" style={{ marginBottom: 10 }}>
        استبعاد <strong>{nameAr}</strong> — قيمته الدفترية {bookValue}.
        <div className="muted">
          الفرق بين المتحصَّل والقيمة الدفترية يُرحَّل ربحاً أو خسارة.
        </div>
      </div>

      <div className="field">
        <label htmlFor={`d-${assetId}`}>تاريخ الاستبعاد</label>
        <input id={`d-${assetId}`} name="disposalDate" type="date" required defaultValue={today()} />
      </div>
      <div className="field">
        <label htmlFor={`p-${assetId}`}>المتحصَّل</label>
        <input id={`p-${assetId}`} name="proceeds" type="text" inputMode="decimal" defaultValue="0" />
      </div>
      <div className="field">
        <label htmlFor={`a-${assetId}`}>حساب المتحصَّل</label>
        <select id={`a-${assetId}`} name="proceedsAccountId">
          <option value="">— بلا متحصَّل —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} — {a.nameAr}</option>
          ))}
        </select>
      </div>

      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn sm primary" type="submit" disabled={pending}>
          {pending ? 'جارٍ…' : 'تأكيد'}
        </button>
        <button className="btn sm" type="button" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  );
}
