import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { StatusPill } from '@/components/ui';
import { DOC_TYPE } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function PortalContracts() {
  const clientId = await guardClient();
  // المسودات لا تظهر للعميل إطلاقاً — ما لم يصدر بعد ليس مستنده.
  const docs = await prisma.document.findMany({
    where: { clientId, type: DOC_TYPE.CONTRACT, status: { not: 'DRAFT' } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <h1>العقود</h1>
      <p className="sub">عقودك وحالة التوقيع على كل منها.</p>
      <div className="card">
        <table>
          <thead>
            <tr><th>الرقم</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">تاريخ الإصدار</th><th /></tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.number}</td>
                <td>{d.titleAr}</td>
                <td className="num">{fmtMoney(d.total)}</td>
                <td><StatusPill status={d.status} /></td>
                <td className="num">{fmtDate(d.createdAt, 'en')}</td>
                <td className="num"><a className="btn ghost sm" href={`/d/${d.publicToken}`}>عرض</a></td>
              </tr>
            ))}
            {!docs.length ? <tr><td colSpan={6} className="muted">لا عقود بعد. العقد يتولّد بعد موافقتك على عرض السعر.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
