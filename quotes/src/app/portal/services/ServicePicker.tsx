'use client';
import { useActionState, useMemo, useState } from 'react';
import { actionRequestQuote } from '@/app/actions';

export interface PortalService {
  id: string;
  code: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  unitPrice: number;
  unitAr: string;
  minQty: number;
  openPrice: boolean;
  attachGovFees: boolean;
  deliveryAr: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function ServicePicker({
  services,
  preselectCode = '',
}: {
  services: PortalService[];
  preselectCode?: string;
}) {
  const [state, action, pending] = useActionState(actionRequestQuote, {});
  const [q, setQ] = useState('');
  // القادم من صفحة الخدمة في الموقع يصل ومعه رمزها، فيفتح على خدمته مباشرة
  // بدل أن يبحث عنها من جديد بين مئة خدمة.
  const [picked, setPicked] = useState<PortalService | null>(
    () => services.find((x) => x.code.toUpperCase() === preselectCode) ?? null,
  );

  const shown = useMemo(() => {
    const t = q.trim();
    if (!t) return services.slice(0, 40);
    return services
      .filter((s) => `${s.nameAr} ${s.nameEn} ${s.code} ${s.category}`.includes(t))
      .slice(0, 40);
  }, [q, services]);

  if (state.ok) {
    return (
      <div className="card">
        <div className="notice good">{state.ok}</div>
        {state.link ? (
          <p style={{ marginTop: 10 }}>
            <a className="btn" href={state.link}>افتح عرض السعر الآن</a>
          </p>
        ) : null}
        <p style={{ marginTop: 10 }}>
          <a className="btn ghost" href="/portal/services">اطلب خدمة أخرى</a>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <label htmlFor="q">ابحث في الخدمات</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الخدمة أو رمزها" />
        <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
          {services.length} خدمة وباقة متاحة. تظهر أول 40 نتيجة.
        </p>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الخدمة</th>
              <th className="num">السعر غير شامل الضريبة</th>
              <th>مدة التنفيذ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{s.nameAr}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{s.category} — {s.code}</div>
                </td>
                <td className="num">
                  {s.openPrice ? <span className="muted">حسب الحالة</span> : `${money(s.unitPrice)} / ${s.unitAr}`}
                </td>
                <td style={{ fontSize: 12.5 }}>{s.deliveryAr || '—'}</td>
                <td className="num">
                  <button type="button" className="btn sm" onClick={() => setPicked(s)}>اطلبها</button>
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr><td colSpan={4} className="muted">لا نتائج مطابقة.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {picked ? (
        <form className="card" action={action} style={{ marginTop: 14 }}>
          <h2>{picked.nameAr}</h2>
          {picked.descAr ? <p className="sub">{picked.descAr}</p> : null}
          <input type="hidden" name="serviceId" value={picked.id} />
          <div className="grid c2">
            <div>
              <label htmlFor="qty">الكمية</label>
              <input id="qty" name="qty" type="number" min={picked.minQty} defaultValue={picked.minQty} />
            </div>
            <div>
              <label htmlFor="noteAr">ملاحظات (اختياري)</label>
              <input id="noteAr" name="noteAr" placeholder="أي تفاصيل تساعدنا" />
            </div>
          </div>

          <div className="notice" style={{ marginTop: 12 }}>
            {picked.openPrice
              ? 'هذه الخدمة تُسعَّر حسب الحالة. يصلك العرض بعد إعداده.'
              : `يصدر عرض السعر فوراً ويصلك على بريدك. الإجمالي شامل ضريبة القيمة المضافة ${money(picked.unitPrice * picked.minQty * 1.15)} ريال.`}
            {picked.attachGovFees ? ' الرسوم الحكومية مستثناة وتُحصَّل بقيمتها الفعلية.' : ''}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={pending}>
              {pending ? 'جارٍ الإصدار' : picked.openPrice ? 'أرسل الطلب' : 'أصدر عرض السعر'}
            </button>
            <button className="btn ghost" type="button" onClick={() => setPicked(null)}>إلغاء</button>
          </div>
          {state.error ? <div className="notice bad">{state.error}</div> : null}
        </form>
      ) : null}
    </>
  );
}
