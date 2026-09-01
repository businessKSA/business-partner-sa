import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney } from '@/lib/money';
import { financeSummary } from '@/lib/finance';

export const dynamic = 'force-dynamic';

/** حدود ربع بإزاحة عن الربع الحالي: 0 الحالي، ‎-1‎ السابق... */
function quarterAt(offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  const qIndex = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3) + offset;
  const y = Math.floor(qIndex / 4);
  const q = ((qIndex % 4) + 4) % 4;
  return {
    from: new Date(Date.UTC(y, q * 3, 1)),
    to: new Date(Date.UTC(y, q * 3 + 3, 1)),
    label: `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][q]} ${y}`,
  };
}

/**
 * مساعد إقرار ضريبة القيمة المضافة — نفس بنود نموذج الهيئة: مبيعات خاضعة
 * ومخرجاتها، مشتريات خاضعة ومدخلاتها، والصافي المستحق أو المسترد.
 * الأرقام تُنسخ إلى الإقرار في بوابة زاتكا كما هي.
 */
export default async function VatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await guardAdmin();
  const { q } = await searchParams;
  const offset = Math.min(0, Number(q) || 0);
  const bounds = quarterAt(offset);
  const s = await financeSummary(bounds.from, bounds.to);
  const deductibleExpenses = await prisma.expense.aggregate({
    where: { date: { gte: bounds.from, lt: bounds.to }, vendorVat: { not: null } },
    _sum: { amountExclVat: true },
  });
  const deductibleNet = deductibleExpenses._sum.amountExclVat || 0;

  return (
    <>
      <h1>إقرار ضريبة القيمة المضافة</h1>
      <p className="sub">
        {bounds.label} — الأرقام بصيغة نموذج الإقرار في بوابة زاتكا: تُنقل كما هي.
        ضريبة المدخلات محسوبة من المصاريف التي سُجِّل لمورّدها رقم ضريبي فقط.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn sm ghost" href={`/admin/finance/vat?q=${offset - 1}`}>الربع الأسبق</Link>
        {offset < 0 ? (
          <Link className="btn sm ghost" href={`/admin/finance/vat?q=${offset + 1}`}>الربع الأحدث</Link>
        ) : null}
        <Link className="btn sm ghost" href="/admin/finance">لوحة المالية</Link>
        <a
          className="btn sm ghost"
          href={`/admin/finance/export?kind=expenses&from=${bounds.from.toISOString().slice(0, 10)}&to=${bounds.to.toISOString().slice(0, 10)}`}
        >
          مصاريف الربع CSV
        </a>
        <a
          className="btn sm ghost"
          href={`/admin/finance/export?kind=revenues&from=${bounds.from.toISOString().slice(0, 10)}&to=${bounds.to.toISOString().slice(0, 10)}`}
        >
          إيرادات الربع CSV
        </a>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>البند</th>
              <th className="num">المبلغ (غير شامل الضريبة)</th>
              <th className="num">الضريبة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>المبيعات الخاضعة للنسبة الأساسية (15٪)</td>
              <td className="num">{fmtMoney(s.revenueNet)}</td>
              <td className="num">{fmtMoney(s.revenueVat)}</td>
            </tr>
            <tr>
              <td>المشتريات الخاضعة القابلة للخصم</td>
              <td className="num">{fmtMoney(deductibleNet)}</td>
              <td className="num">{fmtMoney(s.expenseVat)}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td>{s.vatDue >= 0 ? 'صافي الضريبة المستحقة للهيئة' : 'صافي الضريبة المستردة'}</td>
              <td className="num"></td>
              <td className="num">{fmtMoney(Math.abs(s.vatDue))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        مواعيد الإقرار الربعي: خلال الشهر التالي لنهاية الربع. التأخر يرتّب غرامة
        من الهيئة، فقيّد المصاريف أولاً بأول حتى لا يضيع خصم مدخلات مستحق.
      </div>
    </>
  );
}
