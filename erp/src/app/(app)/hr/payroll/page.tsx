import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty } from '@/components/ui.tsx';

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default async function PayrollPage() {
  const session = await requireAuth('hr.payroll.read');

  const runs = await withTenant(session.tenantId, (tx) =>
    tx.payrollRun.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { payslips: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
  );

  return (
    <>
      <PageHead title="مسيّر الرواتب" sub={`${runs.length} مسيّراً`} />

      <div className="content">
        <Card
          hint="ثلاث مراحل مفصولة: توليدٌ فاعتمادٌ فترحيل. من يجمعها في زرٍّ واحد يجعل خطأً في بدلٍ واحد قيداً في الأستاذ قبل أن يراه أحد."
          flush
        >
          {runs.length === 0 ? (
            <Empty title="لا مسيّرات" hint="ولّد مسيّر الشهر لتبدأ." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>الرقم</th>
                    <th style={{ width: 140 }}>الشهر</th>
                    <th style={{ width: 105 }}>تاريخ الصرف</th>
                    <th className="num" style={{ width: 70 }}>قسائم</th>
                    <th className="num" style={{ width: 130 }}>الإجمالي</th>
                    <th className="num" style={{ width: 130 }}>الخصومات</th>
                    <th className="num" style={{ width: 140 }}>حصة صاحب العمل</th>
                    <th className="num" style={{ width: 140 }}>صافي المستحق</th>
                    <th style={{ width: 100 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/hr/payroll/${r.id}`} className="mono">{r.number}</Link>
                      </td>
                      <td>{MONTHS[r.month - 1]} {r.year}</td>
                      <td><DateText value={r.payDate} /></td>
                      <td className="num">{r._count.payslips}</td>
                      <td className="num"><Money value={r.totalGross} /></td>
                      <td className="num"><Money value={r.totalDeductions} /></td>
                      <td className="num"><Money value={r.totalGosiEmployer} /></td>
                      <td className="num"><Money value={r.totalNet} /></td>
                      <td><Status value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
