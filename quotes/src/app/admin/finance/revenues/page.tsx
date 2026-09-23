import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { COST_CENTER, PAY_METHOD, costCenterLabel } from '@/lib/finance-enums';
import { RevenueForm } from './RevenueForm';

export const dynamic = 'force-dynamic';

export default async function RevenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await guardAdmin();
  const { created } = await searchParams;
  const [entries, paidInvoices] = await Promise.all([
    prisma.revenueEntry.findMany({ orderBy: { date: 'desc' }, take: 100 }),
    prisma.invoice.findMany({
      where: { status: 'PAID', isGovFeeDeposit: false, depositKind: null },
      orderBy: { paidAt: 'desc' },
      include: { client: true, zatcaRecord: { select: { number: true, status: true } } },
      take: 100,
    }),
  ]);

  return (
    <>
      <h1>الإيرادات</h1>
      <p className="sub">
        قسمان: فواتير اللوحة المدفوعة تدخل آلياً، والقيود اليدوية لما حُصِّل خارجها.
      </p>

      {created ? <div className="notice ok">قُيِّد الإيراد {created}.</div> : null}

      <RevenueForm
        centers={Object.entries(COST_CENTER).map(([key, v]) => ({ key, label: v.ar }))}
        methods={Object.entries(PAY_METHOD).map(([key, label]) => ({ key, label }))}
      />

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>قيود يدوية</h3>
        <table>
          <thead>
            <tr>
              <th>الرقم</th>
              <th className="num">التاريخ</th>
              <th>القسم</th>
              <th>المصدر</th>
              <th className="num">المبلغ</th>
              <th className="num">الضريبة</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="sub">لا قيود يدوية بعد.</td></tr>
            ) : (
              entries.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.number}</b></td>
                  <td className="num">{fmtDate(r.date, 'ar')}</td>
                  <td>{costCenterLabel(r.costCenter)}</td>
                  <td>{r.source}<div className="sub">{r.descAr}</div></td>
                  <td className="num">{fmtMoney(r.amountExclVat)}</td>
                  <td className="num">{r.vatAmount ? fmtMoney(r.vatAmount) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>فواتير مدفوعة (تدخل الإيراد آلياً)</h3>
        <table>
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>العميل</th>
              <th className="num">تاريخ السداد</th>
              <th className="num">المبلغ</th>
              <th className="num">الضريبة</th>
              <th>الفاتورة الضريبية</th>
            </tr>
          </thead>
          <tbody>
            {paidInvoices.length === 0 ? (
              <tr><td colSpan={6} className="sub">لا فواتير مدفوعة بعد.</td></tr>
            ) : (
              paidInvoices.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.number}</b><div className="sub">{i.titleAr}</div></td>
                  <td>{i.client.companyAr || i.client.nameAr}</td>
                  <td className="num">{fmtDate(i.paidAt, 'ar')}</td>
                  <td className="num">{fmtMoney(i.amountExclVat)}</td>
                  <td className="num">{fmtMoney(i.vatAmount)}</td>
                  <td>
                    {i.zatcaRecord ? (
                      <Link href={`/admin/invoices/${i.id}/tax`}>{i.zatcaRecord.number}</Link>
                    ) : i.daftraNumber ? (
                      <span className="sub">دفترة {i.daftraNumber}</span>
                    ) : (
                      <Link href={`/admin/invoices/${i.id}/tax`}>إصدار</Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
