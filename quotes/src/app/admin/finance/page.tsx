import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney } from '@/lib/money';
import { financeSummary, monthBounds, quarterBounds, yearBounds } from '@/lib/finance';
import { costCenterLabel } from '@/lib/finance-enums';
import { zatcaPhase2Ready, sellerProfile } from '@/lib/zatca/config';

export const dynamic = 'force-dynamic';

/**
 * لوحة المالية — قراءة واحدة لصحة المنشأة: الإيرادات (فواتير مدفوعة + قيود
 * يدوية) والمصاريف والربح وصافي ضريبة القيمة المضافة، مفصّلة بمركز التكلفة
 * فيظهر أداء كل قسم: الموارد البشرية والمبيعات والمشتريات والتسويق
 * والخدمات المشتركة والخدمات الحكومية.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await guardAdmin();
  const { period } = await searchParams;
  const bounds =
    period === 'year' ? yearBounds() : period === 'quarter' ? quarterBounds() : monthBounds();
  const s = await financeSummary(bounds.from, bounds.to);
  const [dueInvoices, zatcaIssued, zatcaFailed] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: 'DUE' }, _sum: { total: true }, _count: true }),
    prisma.zatcaRecord.count(),
    prisma.zatcaRecord.count({ where: { status: { in: ['FAILED', 'REJECTED'] } } }),
  ]);
  const phase2 = zatcaPhase2Ready();
  const seller = sellerProfile();

  const tabs = [
    { key: 'month', label: 'الشهر الحالي' },
    { key: 'quarter', label: 'الربع الحالي' },
    { key: 'year', label: 'السنة' },
  ];
  const active = period === 'year' || period === 'quarter' ? period : 'month';

  return (
    <>
      <h1>المالية</h1>
      <p className="sub">
        الدفتر الداخلي للمنشأة: مصاريف وإيرادات ورواتب وفواتير ضريبية تصدر من هنا مباشرة —
        بلا اشتراك في منصة خارجية. الفترة المعروضة: {bounds.label}.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            className={`btn sm ${active === t.key ? '' : 'ghost'}`}
            href={`/admin/finance?period=${t.key}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid c4" style={{ margin: '14px 0' }}>
        <div className="card">
          <div className="sub">الإيرادات (غير شاملة الضريبة)</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(s.revenueNet)} ريال</div>
          <div className="sub">{s.invoiceCount} فاتورة مدفوعة في الفترة</div>
        </div>
        <div className="card">
          <div className="sub">المصاريف</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(s.expenseNet)} ريال</div>
        </div>
        <div className="card">
          <div className="sub">الربح</div>
          <div className="num" style={{ fontSize: 22, color: s.profit >= 0 ? '#0a7a3d' : '#b42318' }}>
            {fmtMoney(s.profit)} ريال
          </div>
        </div>
        <div className="card">
          <div className="sub">صافي ضريبة القيمة المضافة</div>
          <div className="num" style={{ fontSize: 22 }}>{fmtMoney(s.vatDue)} ريال</div>
          <div className="sub">مخرجات {fmtMoney(s.revenueVat)} − مدخلات {fmtMoney(s.expenseVat)}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link className="btn" href="/admin/finance/expenses">المصاريف</Link>
        <Link className="btn" href="/admin/finance/revenues">الإيرادات</Link>
        <Link className="btn" href="/admin/finance/hr">الموارد البشرية والرواتب</Link>
        <Link className="btn" href="/admin/finance/vat">إقرار الضريبة</Link>
        <Link className="btn" href="/admin/finance/zatca">الفوترة الإلكترونية</Link>
        <Link className="btn ghost" href="/admin/invoices">فواتير العملاء</Link>
        <Link className="btn ghost" href="/admin/supply">المشتريات والتوريد</Link>
      </div>

      <div className="grid c2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>الأقسام — {bounds.label}</h3>
          <table>
            <thead>
              <tr>
                <th>مركز التكلفة</th>
                <th className="num">إيرادات</th>
                <th className="num">مصاريف</th>
                <th className="num">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {s.byCenter.length === 0 ? (
                <tr><td colSpan={4} className="sub">لا حركات في هذه الفترة بعد.</td></tr>
              ) : (
                s.byCenter.map((r) => (
                  <tr key={r.center}>
                    <td>{costCenterLabel(r.center)}</td>
                    <td className="num">{fmtMoney(r.revenue)}</td>
                    <td className="num">{fmtMoney(r.expense)}</td>
                    <td className="num" style={{ color: r.revenue - r.expense >= 0 ? '#0a7a3d' : '#b42318' }}>
                      {fmtMoney(r.revenue - r.expense)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>الحالة</h3>
          <table>
            <tbody>
              <tr>
                <td>فواتير مستحقة غير محصّلة</td>
                <td className="num">{fmtMoney(dueInvoices._sum.total || 0)} ريال ({dueInvoices._count})</td>
              </tr>
              <tr>
                <td>فواتير ضريبية صادرة داخلياً</td>
                <td className="num">{zatcaIssued}</td>
              </tr>
              {zatcaFailed > 0 ? (
                <tr>
                  <td style={{ color: '#b42318' }}>سجلات تحتاج إعادة إبلاغ</td>
                  <td className="num" style={{ color: '#b42318' }}>{zatcaFailed}</td>
                </tr>
              ) : null}
              <tr>
                <td>وضع الفوترة الإلكترونية</td>
                <td>{phase2 ? 'المرحلة الثانية — ربط مفعّل' : 'المرحلة الأولى — QR وحقول إلزامية'}</td>
              </tr>
              <tr>
                <td>الرقم الضريبي للمنشأة</td>
                <td dir="ltr" className="num">{seller.vatNumber || '—'}</td>
              </tr>
            </tbody>
          </table>
          {!seller.ready ? (
            <div className="notice bad" style={{ marginTop: 10 }}>
              بيانات البائع غير مكتملة: {seller.missing.join('، ')}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
