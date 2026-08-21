import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { journeyStatus } from '@/lib/timeline';
import { fmtDate } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  await guardAdmin();
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { documents: true, files: true } } },
  });
  const journeys = await Promise.all(clients.map((c) => journeyStatus(c.id)));

  return (
    <>
      <h1>العملاء</h1>
      <p className="sub">لكل عميل مجلد باسمه يحتوي: عروض الأسعار · العقود · المرفقات — يُنشأ تلقائياً عند الإضافة.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn" href="/admin/clients/new">عميل جديد</Link>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>التواصل</th>
              <th className="num">المستندات</th>
              <th className="num">المرفقات</th>
              <th>حالة الرحلة</th>
              <th className="num">تاريخ الإضافة</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/clients/${c.id}`}>
                    <b>{c.companyAr || c.nameAr}</b>
                  </Link>
                  <div className="muted">{c.nameAr}{c.crNumber ? ` — السجل ${c.crNumber}` : ''}</div>
                </td>
                <td dir="ltr" style={{ textAlign: 'left', fontSize: 12.5 }}>
                  {c.email}
                  <br />
                  {c.phone}
                </td>
                <td className="num">{c._count.documents}</td>
                <td className="num">{c._count.files}</td>
                <td style={{ fontSize: 12.5 }}>{journeys[i].ar}</td>
                <td className="num">{fmtDate(c.createdAt, 'en')}</td>
              </tr>
            ))}
            {!clients.length ? (
              <tr><td colSpan={6} className="muted">لا يوجد عملاء بعد.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
