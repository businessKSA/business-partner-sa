import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Empty, Kpi, Alert } from '@/components/ui.tsx';

/**
 * لوحة الفوترة الإلكترونية.
 *
 * سؤالها الوحيد: ما الذي لم يصل الهيئة بعد؟ الفاتورة المبسطة تُبلَّغ خلال
 * أربع وعشرين ساعة، والضريبية تُجاز قبل تسليمها — والتأخّر في أيّهما
 * مخالفة، فالتأخير هو ما يجب أن يكون ظاهراً لا مدفوناً في قائمة الفواتير.
 */
export default async function ZatcaPage() {
  const session = await requireAuth('sales.zatca.submit');

  const data = await withTenant(session.tenantId, async (tx) => {
    const config = await tx.zatcaConfig.findUnique({ where: { tenantId: session.tenantId } });

    const pending = await tx.salesInvoice.findMany({
      where: {
        tenantId: session.tenantId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        OR: [{ zatca: { is: null } }, { zatca: { status: 'FAILED' } }],
      },
      include: { partner: { select: { nameAr: true } }, zatca: true },
      orderBy: { issueDate: 'asc' },
      take: 100,
    });

    const recent = await tx.zatcaDocument.findMany({
      where: { tenantId: session.tenantId },
      include: { invoice: { select: { id: true, number: true, total: true, partner: { select: { nameAr: true } } } } },
      orderBy: { icv: 'desc' },
      take: 30,
    });

    const counts = {
      cleared: await tx.zatcaDocument.count({ where: { tenantId: session.tenantId, status: 'CLEARED' } }),
      reported: await tx.zatcaDocument.count({ where: { tenantId: session.tenantId, status: 'REPORTED' } }),
      failed: await tx.zatcaDocument.count({ where: { tenantId: session.tenantId, status: 'FAILED' } }),
    };

    return { config, pending, recent, counts };
  });

  const now = Date.now();

  return (
    <>
      <PageHead
        title="الفوترة الإلكترونية"
        sub="هيئة الزكاة والضريبة والدخل — المرحلة الثانية"
      />

      <div className="content">
        {!data.config ? (
          <Alert kind="warn" title="المنشأة غير مربوطة بمنظومة فاتورة">
            لا يمكن إرسال فاتورة قبل إكمال الربط: توليد المفتاح وطلب التوقيع، ثم شهادة
            الامتثال برمز التحقق من بوّابة فاتورة، ثم اجتياز اختبارات الامتثال، ثم
            شهادة الإنتاج. راجِع <span className="mono">docs/zatca.md</span>.
          </Alert>
        ) : (
          <Alert kind={data.config.environment === 'PRODUCTION' ? 'ok' : 'info'} title={`البيئة: ${
            data.config.environment === 'PRODUCTION' ? 'الإنتاج'
              : data.config.environment === 'SIMULATION' ? 'المحاكاة' : 'الاختبار'
          }`}>
            آخر عدّاد في السلسلة <span className="mono">{data.config.lastIcv}</span>.
            {data.config.lastError ? ` آخر خطأ: ${data.config.lastError}` : ''}
          </Alert>
        )}

        <div className="kpis">
          <Kpi
            label="بانتظار الإرسال"
            value={data.pending.length}
            tone={data.pending.length > 0 ? 'bad' : 'good'}
          />
          <Kpi label="مُجازة" value={data.counts.cleared} />
          <Kpi label="مُبلَّغة" value={data.counts.reported} />
          <Kpi label="مرفوضة" value={data.counts.failed} tone={data.counts.failed > 0 ? 'bad' : undefined} />
        </div>

        <Card
          title="فواتير لم تصل الهيئة"
          hint="المبسطة تُبلَّغ خلال أربع وعشرين ساعة، والضريبية تُجاز قبل تسليمها للعميل."
          flush
        >
          {data.pending.length === 0 ? (
            <Empty title="كل الفواتير أُرسلت" hint="لا شيء معلّق لدى الهيئة." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>الفاتورة</th>
                    <th>العميل</th>
                    <th style={{ width: 110 }}>النوع</th>
                    <th style={{ width: 105 }}>التاريخ</th>
                    <th className="num" style={{ width: 130 }}>الإجمالي</th>
                    <th style={{ width: 150 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending.map((inv) => {
                    const hours = Math.floor((now - inv.issueDate.getTime()) / 3_600_000);
                    const late = inv.kind === 'SIMPLIFIED' && hours > 24;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/sales/invoices/${inv.id}`} className="mono">{inv.number}</Link>
                        </td>
                        <td>{inv.partner.nameAr}</td>
                        <td className="small">
                          {inv.kind === 'SIMPLIFIED' ? 'مبسطة — إبلاغ' : 'ضريبية — إجازة'}
                        </td>
                        <td><DateText value={inv.issueDate} /></td>
                        <td className="num"><Money value={inv.total} /></td>
                        <td>
                          {inv.zatca?.status === 'FAILED'
                            ? <span className="badge bad">رُفضت — أعد الإرسال</span>
                            : late
                              ? <span className="badge bad">تجاوزت ٢٤ ساعة</span>
                              : <span className="badge warn">لم تُرسل</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data.recent.length > 0 ? (
          <Card title="سلسلة الفواتير" hint="كل فاتورة تحمل تجزئة سابقتها — فحذف واحدة يقطع السلسلة عند التالية." flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num" style={{ width: 70 }}>العدّاد</th>
                    <th style={{ width: 140 }}>الفاتورة</th>
                    <th>العميل</th>
                    <th style={{ width: 110 }}>المسار</th>
                    <th style={{ width: 140 }}>الحالة</th>
                    <th style={{ width: 105 }}>الإرسال</th>
                    <th className="num" style={{ width: 70 }}>محاولات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((z) => (
                    <tr key={z.id}>
                      <td className="num">{z.icv}</td>
                      <td>
                        <Link href={`/sales/invoices/${z.invoice.id}`} className="mono">
                          {z.invoice.number}
                        </Link>
                      </td>
                      <td className="small">{z.invoice.partner.nameAr}</td>
                      <td className="small">{z.mode === 'CLEARANCE' ? 'إجازة' : 'إبلاغ'}</td>
                      <td><Status value={z.status} /></td>
                      <td><DateText value={z.submittedAt} /></td>
                      <td className="num">{z.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
