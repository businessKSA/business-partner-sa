import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { StatusPill } from '@/components/ui';
import { DOC_TYPE } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function PortalQuotes() {
  const clientId = await guardClient();
  // المسودات لا تظهر للعميل إطلاقاً — ما لم يصدر بعد ليس مستنده.
  const docs = await prisma.document.findMany({
    where: { clientId, type: DOC_TYPE.QUOTE, status: { not: 'DRAFT' } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <h1>عروض الأسعار</h1>
      <p className="sub">كل عرض صادر لك. الأسعار غير شاملة ضريبة القيمة المضافة، والرسوم الحكومية مستثناة.</p>
      <div className="card">
        <table>
          <thead>
            <tr><th>الرقم</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">صالح حتى</th><th /></tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.number}</td>
                <td>{d.titleAr}</td>
                <td className="num">{fmtMoney(d.total)}</td>
                <td><StatusPill status={d.status} /></td>
                <td className="num">{d.validUntil ? fmtDate(d.validUntil, 'en') : '—'}</td>
                <td className="num"><a className="btn ghost sm" href={`/d/${d.publicToken}`}>عرض</a></td>
              </tr>
            ))}
            {!docs.length ? <tr><td colSpan={6} className="muted">لا عروض بعد. اطلب خدمة ويصدر عرضك فوراً.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
