import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/money';
import { SUPPLY_STATUS_LABEL } from '@/lib/enums';
import { categoryLabel } from '@/lib/categories';
import SupplierForms from './SupplierForms';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ newRequest?: string }>;
}) {
  await guardAdmin();
  const sp = await searchParams;
  const [suppliers, requests, clients] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.supplyRequest.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <>
      <h1>الموردون وطلبات التوريد</h1>
      <p className="sub">
        بزنس بارتنر شريك منسّق: تضبط النطاق وتقارن العروض وتدير الفلوس من محفظة العميل وتؤرشف المستندات.
      </p>

      <SupplierForms
        preselectedClient={sp.newRequest ?? ''}
        clients={clients.map((c) => ({ id: c.id, label: `${c.companyAr || c.nameAr} — ${c.email}` }))}
      />

      <div className="card">
        <h2>طلبات التوريد ({requests.length})</h2>
        <table>
          <thead><tr><th>الرقم</th><th>العميل</th><th>العنوان</th><th>الحالة</th><th className="num">التاريخ</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="mono"><Link href={`/admin/supply/${r.id}`}>{r.number}</Link></td>
                <td><Link href={`/admin/clients/${r.clientId}`}>{r.client.companyAr || r.client.nameAr}</Link></td>
                <td>{r.titleAr}</td>
                <td>
                  <span className="pill">{SUPPLY_STATUS_LABEL[r.status]?.ar ?? r.status}</span>
                  {r.mode === 'RESALE' ? <span className="pill"> إعادة بيع</span> : null}
                </td>
                <td className="num">{fmtDate(r.createdAt, 'en')}</td>
              </tr>
            ))}
            {!requests.length ? <tr><td colSpan={5} className="muted">لا توجد طلبات توريد.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>الموردون ({suppliers.length})</h2>
        <table>
          <thead><tr><th>المورد</th><th>التصنيفات</th><th>السجل التجاري</th><th>النشاط</th><th>الآيبان</th><th>التواصل</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td><b>{s.nameAr}</b><div className="muted" dir="ltr" style={{ textAlign: 'left' }}>{s.nameEn ?? ''}</div></td>
                <td>
                  {s.categories ? (
                    String(s.categories)
                      .split(',')
                      .map((c) => categoryLabel(c.trim().toLowerCase()))
                      .join('، ')
                  ) : (
                    <span className="muted">بلا تصنيف — لا تصله طلبات العروض</span>
                  )}
                  {s.city ? <div className="muted">{s.city}</div> : null}
                </td>
                <td className="mono">{s.crNumber ?? '—'}</td>
                <td>{s.activityAr ?? '—'}</td>
                <td className="mono" style={{ fontSize: 11 }}>{s.iban ?? '—'}</td>
                <td dir="ltr" style={{ textAlign: 'left', fontSize: 12 }}>{s.email ?? ''}<br />{s.phone ?? ''}</td>
              </tr>
            ))}
            {!suppliers.length ? <tr><td colSpan={6} className="muted">لا يوجد موردون.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
