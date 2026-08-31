'use client';
import { useActionState, useMemo, useState } from 'react';
import { actionRequestQuote, actionRequestSourcing } from '@/app/actions';

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
  /** خدمة تُنفَّذ عبر موردين: تُطلب بنموذج تفاصيل لا بكمية. */
  sourcingCategory: string | null;
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
  const [src, srcAction, srcPending] = useActionState(actionRequestSourcing, {});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  // القادم من صفحة الخدمة في الموقع يصل ومعه رمزها، فيفتح على خدمته مباشرة
  // بدل أن يبحث عنها من جديد بين مئة خدمة.
  const [picked, setPicked] = useState<PortalService | null>(
    () => services.find((x) => x.code.toUpperCase() === preselectCode) ?? null,
  );

  // التصنيفات بترتيب عددها: القسم الذي فيه أربعون خدمة يُفتح قبل الذي فيه واحدة.
  const cats = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of services) n.set(s.category, (n.get(s.category) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [services]);

  const shown = useMemo(() => {
    // البحث كان حسّاساً لحالة الأحرف ويطابق النص كما كُتب، فمن كتب رمزاً
    // بحروف صغيرة لم يجد خدمته وهي أمامه.
    const t = q.trim().toLowerCase();
    return services.filter((s) => {
      if (cat && s.category !== cat) return false;
      if (!t) return true;
      return `${s.nameAr} ${s.nameEn} ${s.code} ${s.category}`.toLowerCase().includes(t);
    });
  }, [q, cat, services]);

  const done = state.ok || src.ok;
  if (done) {
    return (
      <div className="card">
        <div className="notice ok">{done}</div>
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

        {/* كانت الصفحة تعرض أربعين صفاً من مئة وستين وتقول ذلك في سطر صغير
            تحت خانة البحث. فمن لم يقرأ السطر ظنّ أن ما ليس في الأربعين غير
            موجود، ومن قرأه احتاج أن يعرف اسم خدمته ليكتبه — والكتالوج يُتصفَّح
            قبل أن يُبحث فيه. التصنيفات تفتحه، ولا سقف بعدها. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <button
            type="button"
            className={cat ? 'btn ghost sm' : 'btn sm'}
            onClick={() => setCat('')}
          >
            الكل ({services.length})
          </button>
          {cats.map(([name, n]) => (
            <button
              key={name}
              type="button"
              className={cat === name ? 'btn sm' : 'btn ghost sm'}
              onClick={() => setCat(cat === name ? '' : name)}
            >
              {name} ({n})
            </button>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
          {shown.length === services.length
            ? `${services.length} خدمة وباقة — كلها معروضة.`
            : `${shown.length} من ${services.length} خدمة.`}
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
                  {s.sourcingCategory ? (
                    <span className="muted">حسب طلبك</span>
                  ) : s.openPrice ? (
                    <span className="muted">حسب الحالة</span>
                  ) : (
                    `${money(s.unitPrice)} / ${s.unitAr}`
                  )}
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

      {/* الخدمة التي تُنفَّذ عبر موردين تُطلب بتفاصيلها لا بكميتها: من يريد
          مساحة عمل لا يعرف «كم خدمة» يطلب، ويعرف كم موظفاً وفي أي حيّ ومتى.
          والنموذج يسأله ما يُسعَّر عليه فعلاً. */}
      {picked?.sourcingCategory ? (
        <form className="card" action={srcAction} style={{ marginTop: 14 }} key={picked.id}>
          <h2>{picked.nameAr}</h2>
          {picked.descAr ? <p className="sub">{picked.descAr}</p> : null}
          <input type="hidden" name="serviceId" value={picked.id} />

          <label htmlFor="detailsAr">تفاصيل طلبك</label>
          <textarea
            id="detailsAr"
            name="detailsAr"
            rows={5}
            required
            placeholder="اكتب ما تحتاجه بالتفصيل: الغرض، والمواصفات المطلوبة، وأي شرط يهمّك"
          />

          <div className="grid c2" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor="cityAr">المدينة أو الحيّ</label>
              <input id="cityAr" name="cityAr" placeholder="الرياض — حي العليا" />
            </div>
            <div>
              <label htmlFor="sizeAr">الكمية أو المساحة</label>
              <input id="sizeAr" name="sizeAr" placeholder="مثال: 12 موظفاً — أو 300 متر" />
            </div>
            <div>
              <label htmlFor="budgetAr">الميزانية التقريبية (اختياري)</label>
              <input id="budgetAr" name="budgetAr" placeholder="بالريال سنوياً أو شهرياً" />
            </div>
            <div>
              <label htmlFor="neededAr">موعد الحاجة</label>
              <input id="neededAr" name="neededAr" placeholder="مثال: خلال شهر" />
            </div>
          </div>

          <div className="notice" style={{ marginTop: 12 }}>
            نُعدّ لك العرض بعد دراسة طلبك ويصلك على بريدك. الأسعار غير شاملة ضريبة القيمة
            المضافة، والرسوم الحكومية إن وُجدت مستثناة وتُحصَّل بقيمتها الفعلية.
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={srcPending}>
              {srcPending ? 'جارٍ الإرسال' : 'أرسل الطلب'}
            </button>
            <button className="btn ghost" type="button" onClick={() => setPicked(null)}>إلغاء</button>
          </div>
          {src.error ? <div className="notice bad">{src.error}</div> : null}
        </form>
      ) : picked ? (
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
