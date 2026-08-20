import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney } from '@/lib/money';
import ServiceForm from './ServiceForm';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await guardAdmin();
  const sp = await searchParams;
  const [services, govFees] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    prisma.govFee.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  const editing = sp.edit ? services.find((s) => s.id === sp.edit) : null;

  return (
    <>
      <h1>كتالوج الخدمات</h1>
      <p className="sub">
        إضافة وتعديل الخدمات وأسعارها. الأسعار غير شاملة ضريبة القيمة المضافة، والرسوم الحكومية مستثناة دائماً.
      </p>

      <ServiceForm service={editing ?? null} />

      <div className="card">
        <h2>الخدمات ({services.length})</h2>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الخدمة</th>
              <th className="num">سعر الوحدة</th>
              <th>الوحدة</th>
              <th>شروط الدفع</th>
              <th>مدة التنفيذ</th>
              <th className="num">الحالة</th>
              <th className="num">تعديل</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.code}</td>
                <td>
                  <div>{s.nameAr}</div>
                  <div className="muted" dir="ltr" style={{ textAlign: 'left' }}>{s.nameEn}</div>
                </td>
                <td className="num">{s.openPrice ? 'سعر مفتوح' : fmtMoney(s.unitPrice)}</td>
                <td>{s.unitAr}</td>
                <td style={{ fontSize: 12 }}>{s.paymentTermsAr || '—'}</td>
                <td style={{ fontSize: 12 }}>{s.deliveryAr || '—'}</td>
                <td className="num">
                  <span className={s.active ? 'pill st-ACCEPTED' : 'pill st-DRAFT'}>
                    {s.active ? 'مفعّلة' : 'موقوفة'}
                  </span>
                  {s.aiCreated ? <div className="muted" style={{ fontSize: 11 }}>من الوكيل</div> : null}
                  {s.attachGovFees ? <div className="muted" style={{ fontSize: 11 }}>مع ملحق الرسوم</div> : null}
                </td>
                <td className="num">
                  <a className="btn ghost sm" href={`/admin/catalog?edit=${s.id}`}>تعديل</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>جدول الرسوم الحكومية المقدّرة ({govFees.length} بند)</h2>
        <p className="muted">
          يُدرَج تلقائياً كملحق في عرض وعقد أي خدمة مفعّل لها خيار «إرفاق جدول الرسوم الحكومية».
          الرسوم تُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.
        </p>
        <table>
          <thead>
            <tr>
              <th>البند</th>
              <th className="num">الرسم المقدّر (ريال)</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {govFees.map((g) => (
              <tr key={g.id}>
                <td>
                  <div>{g.labelAr}</div>
                  <div className="muted" dir="ltr" style={{ textAlign: 'left' }}>{g.labelEn}</div>
                </td>
                <td className="num">{g.amount === null ? '—' : fmtMoney(g.amount)}</td>
                <td style={{ fontSize: 12 }}>
                  {g.amountNoteAr || (g.included ? '' : 'غير مشمولة')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
