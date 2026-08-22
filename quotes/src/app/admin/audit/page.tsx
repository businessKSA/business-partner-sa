import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { verifyAuditChain } from '@/lib/timeline';
import { fmtMoney, fmtDateTime } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await guardAdmin();
  const [rows, check] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { seq: 'desc' }, take: 300 }),
    verifyAuditChain(),
  ]);

  return (
    <>
      <h1>سجل التدقيق</h1>
      <p className="sub">
        سجل غير قابل للتعديل لكل الحركات المالية، مسلسل بسلسلة تجزئة — أي تعديل لاحق على أي سطر يكسر السلسلة ويُكتشف فوراً.
      </p>
      {check.ok ? (
        <div className="notice ok">
          سلسلة التدقيق سليمة. عدد القيود: {check.count}.
        </div>
      ) : (
        <div className="notice bad">
          انكسرت سلسلة التدقيق عند القيد رقم {check.brokenAt}. تحقق من قاعدة البيانات فوراً.
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>الحركة</th>
              <th>الكيان</th>
              <th className="num">المبلغ</th>
              <th>الفاعل</th>
              <th className="num">التاريخ</th>
              <th>التجزئة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq}>
                <td className="num">{r.seq}</td>
                <td className="mono">{r.action}</td>
                <td className="mono" style={{ fontSize: 11 }}>{r.entityType}/{r.entityId.slice(-8)}</td>
                <td className="num">{r.amount === null ? '—' : fmtMoney(r.amount)}</td>
                <td>{r.actor}</td>
                <td className="num" style={{ fontSize: 11 }}>{fmtDateTime(r.createdAt, 'en')}</td>
                <td className="mono" style={{ fontSize: 10 }}>{r.hash.slice(0, 16)}…</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted">لا توجد قيود بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
