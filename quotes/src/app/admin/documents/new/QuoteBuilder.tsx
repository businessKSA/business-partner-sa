'use client';
import { useActionState, useState } from 'react';
import { actionCreateQuote } from '@/app/actions';

export interface SvcOpt {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  unitPrice: number;
  unitAr: string;
  unitEn: string;
  minQty: number;
  openPrice: boolean;
  paymentTermsAr: string;
  paymentTermsEn: string;
  deliveryAr: string;
  deliveryEn: string;
}

interface Row {
  key: number;
  serviceId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  qty: number;
  unitPrice: number;
  unitAr: string;
  unitEn: string;
  paymentTermsAr: string;
  paymentTermsEn: string;
  deliveryAr: string;
  deliveryEn: string;
}

const VAT = 0.15;
const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.round((n + Number.EPSILON) * 100) / 100,
  );

function emptyRow(key: number): Row {
  return {
    key,
    serviceId: '',
    code: 'CUSTOM',
    nameAr: '',
    nameEn: '',
    descAr: '',
    descEn: '',
    qty: 1,
    unitPrice: 0,
    unitAr: 'خدمة',
    unitEn: 'service',
    paymentTermsAr: '',
    paymentTermsEn: '',
    deliveryAr: '',
    deliveryEn: '',
  };
}

export default function QuoteBuilder({
  clients,
  services,
  preselectedClient,
}: {
  clients: { id: string; label: string }[];
  services: SvcOpt[];
  preselectedClient: string;
}) {
  const [state, action, pending] = useActionState(actionCreateQuote, {});
  const [rows, setRows] = useState<Row[]>([emptyRow(1)]);
  const [nextKey, setNextKey] = useState(2);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const pickService = (key: number, serviceId: string) => {
    if (!serviceId) return update(key, { ...emptyRow(key), key });
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    update(key, {
      serviceId: s.id,
      code: s.code,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      descAr: s.descAr,
      descEn: s.descEn,
      qty: s.minQty,
      unitPrice: s.unitPrice,
      unitAr: s.unitAr,
      unitEn: s.unitEn,
      paymentTermsAr: s.paymentTermsAr,
      paymentTermsEn: s.paymentTermsEn,
      deliveryAr: s.deliveryAr,
      deliveryEn: s.deliveryEn,
    });
  };

  const subtotal = rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0), 0);
  const vat = subtotal * VAT;
  const total = subtotal + vat;

  return (
    <>
      <h1>عرض سعر جديد</h1>
      <p className="sub">
        أضف خدمة أو عدة خدمات إلى نفس العرض. البنود من الكتالوج بسعرها، أو بند مخصص بسعر يدوي.
        يُحفظ العرض كمسودة ولا يُرسَل قبل الاعتماد.
      </p>

      <form action={action}>
        <div className="card">
          <div className="grid c2">
            <div>
              <label htmlFor="clientId">العميل *</label>
              <select id="clientId" name="clientId" required defaultValue={preselectedClient}>
                <option value="">— اختر عميلاً —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: 6 }}>
                لا يوجد العميل؟ <a href="/admin/clients/new">أضِف عميلاً جديداً</a>
              </p>
            </div>
            <div>
              <label htmlFor="validityDays">صلاحية العرض بالأيام (فارغ = افتراضي الخدمة أو 30)</label>
              <input id="validityDays" name="validityDays" type="number" min="1" placeholder="30" />
            </div>
            <div>
              <label htmlFor="titleAr">عنوان العرض بالعربي</label>
              <input id="titleAr" name="titleAr" placeholder="عرض سعر" />
            </div>
            <div>
              <label htmlFor="titleEn">عنوان العرض بالإنجليزي</label>
              <input id="titleEn" name="titleEn" placeholder="Quotation" dir="ltr" />
            </div>
            <div>
              <label htmlFor="introAr">الموضوع بالعربي</label>
              <textarea id="introAr" name="introAr" />
            </div>
            <div>
              <label htmlFor="introEn">الموضوع بالإنجليزي</label>
              <textarea id="introEn" name="introEn" dir="ltr" />
            </div>
            <div>
              <label htmlFor="notesAr">نطاق الخدمات / ملاحظات بالعربي</label>
              <textarea id="notesAr" name="notesAr" />
            </div>
            <div>
              <label htmlFor="notesEn">نطاق الخدمات / ملاحظات بالإنجليزي</label>
              <textarea id="notesEn" name="notesEn" dir="ltr" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>سلة البنود</h2>
          <input type="hidden" name="rowCount" value={rows.length} />
          {rows.map((r, i) => (
            <div key={r.key} className="card" style={{ background: 'var(--wash)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>البند {i + 1}</b>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}
                  >
                    حذف البند
                  </button>
                ) : null}
              </div>

              <label>الخدمة من الكتالوج (أو اتركها فارغة لبند مخصص)</label>
              <select value={r.serviceId} onChange={(e) => pickService(r.key, e.target.value)}>
                <option value="">— بند مخصص بسعر يدوي —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.nameAr}
                    {s.openPrice ? ' (سعر مفتوح)' : ` — ${money(s.unitPrice)} ريال`}
                  </option>
                ))}
              </select>

              <input type="hidden" name={`item_${i}_serviceId`} value={r.serviceId} />
              <input type="hidden" name={`item_${i}_code`} value={r.code} />
              <input type="hidden" name={`item_${i}_unitAr`} value={r.unitAr} />
              <input type="hidden" name={`item_${i}_unitEn`} value={r.unitEn} />

              <div className="grid c2">
                <div>
                  <label>اسم الخدمة بالعربي *</label>
                  <input
                    name={`item_${i}_nameAr`}
                    value={r.nameAr}
                    onChange={(e) => update(r.key, { nameAr: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>اسم الخدمة بالإنجليزي</label>
                  <input
                    name={`item_${i}_nameEn`}
                    value={r.nameEn}
                    onChange={(e) => update(r.key, { nameEn: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label>الوصف المختصر بالعربي</label>
                  <textarea
                    name={`item_${i}_descAr`}
                    value={r.descAr}
                    onChange={(e) => update(r.key, { descAr: e.target.value })}
                  />
                </div>
                <div>
                  <label>الوصف المختصر بالإنجليزي</label>
                  <textarea
                    name={`item_${i}_descEn`}
                    value={r.descEn}
                    onChange={(e) => update(r.key, { descEn: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid c3">
                <div>
                  <label>الكمية *</label>
                  <input
                    name={`item_${i}_qty`}
                    type="number"
                    step="1"
                    min="0"
                    value={r.qty}
                    onChange={(e) => update(r.key, { qty: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label>سعر الوحدة (ريال، غير شامل الضريبة) *</label>
                  <input
                    name={`item_${i}_unitPrice`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.unitPrice}
                    onChange={(e) => update(r.key, { unitPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label>إجمالي البند</label>
                  <input readOnly value={money((Number(r.qty) || 0) * (Number(r.unitPrice) || 0))} dir="ltr" />
                </div>
              </div>

              <div className="grid c2">
                <div>
                  <label>شروط الدفع بالعربي</label>
                  <input
                    name={`item_${i}_paymentTermsAr`}
                    value={r.paymentTermsAr}
                    onChange={(e) => update(r.key, { paymentTermsAr: e.target.value })}
                  />
                </div>
                <div>
                  <label>شروط الدفع بالإنجليزي</label>
                  <input
                    name={`item_${i}_paymentTermsEn`}
                    value={r.paymentTermsEn}
                    onChange={(e) => update(r.key, { paymentTermsEn: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label>مدة التنفيذ بالعربي</label>
                  <input
                    name={`item_${i}_deliveryAr`}
                    value={r.deliveryAr}
                    onChange={(e) => update(r.key, { deliveryAr: e.target.value })}
                  />
                </div>
                <div>
                  <label>مدة التنفيذ بالإنجليزي</label>
                  <input
                    name={`item_${i}_deliveryEn`}
                    value={r.deliveryEn}
                    onChange={(e) => update(r.key, { deliveryEn: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setRows((r) => [...r, emptyRow(nextKey)]);
                setNextKey((k) => k + 1);
              }}
            >
              إضافة بند آخر
            </button>
          </div>

          <div className="totals" style={{ marginTop: 18 }}>
            <table>
              <tbody>
                <tr>
                  <td>المجموع غير شامل ضريبة القيمة المضافة</td>
                  <td className="num">{money(subtotal)}</td>
                </tr>
                <tr>
                  <td>ضريبة القيمة المضافة <span dir="ltr">15%</span></td>
                  <td className="num">{money(vat)}</td>
                </tr>
                <tr className="grand">
                  <td>الإجمالي شامل ضريبة القيمة المضافة</td>
                  <td className="num">{money(total)} SAR</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            الرسوم الحكومية مستثناة دائماً وتُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.
          </p>
        </div>

        <div className="row">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'جارٍ الحفظ' : 'حفظ كمسودة'}
          </button>
          <a className="btn ghost" href="/admin">إلغاء</a>
        </div>
        {state.error ? <div className="notice bad">{state.error}</div> : null}
      </form>
    </>
  );
}
