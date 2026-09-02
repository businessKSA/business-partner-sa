import Link from 'next/link';
import { requireSession } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { profitAndLoss, balanceSheet, partnerAging } from '@/lib/accounting/reports.ts';
import { vatReturn } from '@/lib/accounting/vat.ts';
import { auditLedgerIntegrity } from '@/lib/accounting/posting.ts';
import { reconcileStock } from '@/lib/inventory/costing.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Kpi, Money, Status, DateText, Empty, Alert } from '@/components/ui.tsx';
import { d, money } from '@/lib/money.ts';

/**
 * اللوحة الرئيسية.
 *
 * ما تعرضه ليس «كل شيء» بل ما يستدعي فعلاً: أرقام الشهر، وما يحتاج تحصيلاً،
 * وما يحتاج إبلاغاً للهيئة، وأي عطبٍ في الدفتر أو المخزون. لوحةٌ تعرض
 * عشرين رسماً بيانياً جميلاً لا تقول لصاحبها ماذا يفعل صباح اليوم.
 */
export default async function Dashboard() {
  const session = await requireSession();
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const data = await withTenant(session.tenantId, async (tx) => {
    const [ytd, mtd, bs, aging, vat, ledgerIssues, stockDrift] = await Promise.all([
      profitAndLoss(tx, session.tenantId, yearStart, now),
      profitAndLoss(tx, session.tenantId, monthStart, now),
      balanceSheet(tx, session.tenantId, now, yearStart),
      partnerAging(tx, session.tenantId, 'RECEIVABLE', now),
      vatReturn(tx, session.tenantId, yearStart, now),
      auditLedgerIntegrity(tx, session.tenantId),
      reconcileStock(tx, session.tenantId),
    ]);

    const overdue = await tx.salesInvoice.findMany({
      where: {
        tenantId: session.tenantId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      include: { partner: { select: { nameAr: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    });

    const pendingZatca = await tx.salesInvoice.count({
      where: {
        tenantId: session.tenantId,
        status: { not: 'DRAFT' },
        zatca: { is: null },
      },
    });

    const draftInvoices = await tx.salesInvoice.count({
      where: { tenantId: session.tenantId, status: 'DRAFT' },
    });

    return { ytd, mtd, bs, aging, vat, ledgerIssues, stockDrift, overdue, pendingZatca, draftInvoices };
  });

  const receivables = money(data.aging.reduce((s, a) => s.plus(a.total), d(0)));
  const overdueTotal = money(
    data.overdue.reduce((s, i) => s.plus(d(i.total).minus(d(i.paidAmount))), d(0)),
  );

  return (
    <>
      <PageHead
        title="اللوحة الرئيسية"
        sub={`${session.tenantName} — ${now.toISOString().slice(0, 10)}`}
      />

      <div className="content">
        {/* الأعطاب أولاً: ما يحتاج تدخّلاً يسبق ما يحتاج قراءة */}
        {data.ledgerIssues.length > 0 ? (
          <Alert kind="error" title="خلل في الدفتر">
            {data.ledgerIssues.length} قيداً غير متزن في سطوره. هذا يبطل كل تقرير بعده —
            راجِعها فوراً في <Link href="/accounting/journal">قيود اليومية</Link>.
          </Alert>
        ) : null}

        {!data.bs.balanced ? (
          <Alert kind="error" title="المركز المالي لا يتوازن">
            الفرق <Money value={data.bs.difference} /> ريالاً. الخلل في الدفتر لا في التقرير.
          </Alert>
        ) : null}

        {data.stockDrift.length > 0 ? (
          <Alert kind="warn" title="انحراف في أرصدة المخزون">
            {data.stockDrift.length} صنفاً رصيده المحفوظ يخالف مجموع حركاته.
            هذا ما يُكتشف عادةً في الجرد السنوي — <Link href="/inventory/valuation">راجِعه الآن</Link>.
          </Alert>
        ) : null}

        <div className="kpis">
          <Kpi
            label="إيراد الشهر"
            value={<Money value={data.mtd.sections[0].total} currency="ر.س" />}
          />
          <Kpi
            label="صافي ربح الشهر"
            value={<Money value={data.mtd.netProfit} currency="ر.س" />}
            tone={data.mtd.netProfit.isNegative() ? 'bad' : 'good'}
            note={data.mtd.netMargin ? `الهامش ${data.mtd.netMargin.toFixed(1)}٪` : undefined}
          />
          <Kpi
            label="إيراد السنة حتى اليوم"
            value={<Money value={data.ytd.sections[0].total} currency="ر.س" />}
          />
          <Kpi
            label="صافي ربح السنة"
            value={<Money value={data.ytd.netProfit} currency="ر.س" />}
            tone={data.ytd.netProfit.isNegative() ? 'bad' : 'good'}
          />
          <Kpi
            label="ذمم العملاء"
            value={<Money value={receivables} currency="ر.س" />}
            note={`منها ${overdueTotal.toFixed(2)} متأخّرة`}
            tone={overdueTotal.greaterThan(0) ? 'bad' : undefined}
          />
          <Kpi
            label="ضريبة القيمة المضافة المستحقة"
            value={<Money value={data.vat.netVat} currency="ر.س" />}
            note="من بداية السنة"
          />
        </div>

        <div className="grid-2">
          <Card
            title="فواتير تجاوزت أجل السداد"
            hint="مرتَّبة بالأقدم استحقاقاً"
            actions={<Link className="btn sm" href="/sales/aging">أعمار الذمم</Link>}
            flush
          >
            {data.overdue.length === 0 ? (
              <Empty title="لا فواتير متأخّرة" hint="كل المستحقّ سُدِّد في أجله." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>العميل</th>
                      <th>الاستحقاق</th>
                      <th className="num">المتبقّي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdue.map((inv) => {
                      const remaining = money(d(inv.total).minus(d(inv.paidAmount)));
                      const daysLate = Math.floor(
                        (now.getTime() - new Date(inv.dueDate!).getTime()) / 86_400_000,
                      );
                      return (
                        <tr key={inv.id}>
                          <td>
                            <Link href={`/sales/invoices/${inv.id}`} className="mono">{inv.number}</Link>
                          </td>
                          <td>{inv.partner.nameAr}</td>
                          <td>
                            <DateText value={inv.dueDate} />
                            <span className="badge bad" style={{ marginInlineStart: 6 }}>
                              متأخّرة {daysLate} يوماً
                            </span>
                          </td>
                          <td className="num"><Money value={remaining} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div>
            <Card title="ما يحتاج إجراءً">
              <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2 }}>
                {data.draftInvoices > 0 ? (
                  <li>
                    <Link href="/sales/invoices?status=DRAFT">{data.draftInvoices} فاتورة مسوّدة</Link>
                    {' '}لم تُرحَّل بعد — لا أثر لها في الدفتر ولا لدى الهيئة.
                  </li>
                ) : null}
                {data.pendingZatca > 0 ? (
                  <li>
                    <Link href="/sales/zatca">{data.pendingZatca} فاتورة مرحَّلة</Link>
                    {' '}لم تُرسل لهيئة الزكاة والضريبة.
                  </li>
                ) : null}
                {data.draftInvoices === 0 && data.pendingZatca === 0 ? (
                  <li className="muted">لا شيء معلّق.</li>
                ) : null}
              </ul>
            </Card>

            <Card title="ملخّص المركز المالي" hint={`كما في ${now.toISOString().slice(0, 10)}`}>
              <table>
                <tbody>
                  <tr>
                    <td>إجمالي الأصول</td>
                    <td className="num"><Money value={data.bs.totalAssets} /></td>
                  </tr>
                  <tr>
                    <td>إجمالي الخصوم</td>
                    <td className="num"><Money value={data.bs.totalLiabilities} /></td>
                  </tr>
                  <tr>
                    <td>حقوق الملكية</td>
                    <td className="num"><Money value={data.bs.totalEquity} /></td>
                  </tr>
                  <tr>
                    <td className="muted small">منها أرباح العام الجاري</td>
                    <td className="num muted small"><Money value={data.bs.currentYearProfit} /></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>التوازن</td>
                    <td className="num">
                      {data.bs.balanced
                        ? <span className="badge ok">متوازن</span>
                        : <span className="badge bad">فرق {data.bs.difference.toFixed(2)}</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
