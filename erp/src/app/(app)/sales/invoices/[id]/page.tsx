import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Qty, Status, DateText, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { InvoiceActions } from './actions.tsx';
import { can } from '@/lib/rbac.ts';
import { d, money } from '@/lib/money.ts';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth('sales.invoice.read');
  const { id } = await params;

  const invoice = await withTenant(session.tenantId, (tx) =>
    tx.salesInvoice.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        partner: true,
        lines: { include: { taxCode: true }, orderBy: { sortOrder: 'asc' } },
        zatca: true,
        allocations: { include: { payment: { select: { number: true, paymentDate: true, method: true } } } },
        project: { select: { id: true, nameAr: true } },
        originalInvoice: { select: { id: true, number: true } },
      },
    }),
  );

  if (!invoice) notFound();

  const remaining = money(d(invoice.total).minus(d(invoice.paidAmount)));
  const isCredit = invoice.docType === 'CREDIT_NOTE';

  return (
    <>
      <PageHead
        title={`${isCredit ? 'إشعار دائن' : 'فاتورة'} ${invoice.number}`}
        sub={`${invoice.partner.nameAr} · ${invoice.kind === 'SIMPLIFIED' ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية'}`}
        actions={
          <>
            <PrintButton />
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              zatcaStatus={invoice.zatca?.status ?? null}
              canPost={can(session.permissions, 'sales.invoice.post')}
              canCancel={can(session.permissions, 'sales.invoice.cancel')}
              canSubmit={can(session.permissions, 'sales.zatca.submit')}
            />
          </>
        }
      />

      <div className="content">
        {invoice.status === 'DRAFT' ? (
          <Alert kind="warn" title="مسوّدة">
            لا أثر لهذه الفاتورة في الدفتر ولا لدى الهيئة حتى تُرحَّل. تُعدَّل وتُحذف بحرية قبل الترحيل.
          </Alert>
        ) : null}

        {invoice.originalInvoice ? (
          <Alert kind="info" title="إشعار تصحيحي">
            يعدّل الفاتورة{' '}
            <Link href={`/sales/invoices/${invoice.originalInvoice.id}`}>
              {invoice.originalInvoice.number}
            </Link>
            {invoice.correctionReason ? ` — ${invoice.correctionReason}` : ''}
          </Alert>
        ) : null}

        {invoice.zatca?.status === 'FAILED' ? (
          <Alert kind="error" title="رفضتها الهيئة">
            {JSON.stringify(invoice.zatca.errors)}
          </Alert>
        ) : null}

        {invoice.zatca?.status === 'WARNING' ? (
          <Alert kind="warn" title="قُبلت مع ملاحظات">
            الفاتورة نافذة، والملاحظات تُعالج في الفواتير القادمة.
          </Alert>
        ) : null}

        <div className="grid-4" style={{ marginBottom: 16 }}>
          <Card><div className="small muted">التاريخ</div><div><DateText value={invoice.issueDate} /></div></Card>
          <Card><div className="small muted">الاستحقاق</div><div><DateText value={invoice.dueDate} /></div></Card>
          <Card><div className="small muted">الحالة</div><div><Status value={invoice.status} /></div></Card>
          <Card>
            <div className="small muted">المتبقّي</div>
            <div><Money value={remaining} currency="ر.س" /></div>
          </Card>
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <Card title="البائع">
            <TenantParty tenantId={session.tenantId} />
          </Card>
          <Card title="المشتري">
            <div style={{ fontWeight: 600 }}>{invoice.partner.nameAr}</div>
            <div className="small muted">
              {invoice.partner.vatNumber
                ? <>الرقم الضريبي <span className="mono">{invoice.partner.vatNumber}</span></>
                : invoice.partner.otherIdValue
                  ? <>{invoice.partner.otherIdType} <span className="mono">{invoice.partner.otherIdValue}</span></>
                  : <span className="neg">بلا معرّف ضريبي</span>}
            </div>
            <div className="small muted">
              {[invoice.partner.street, invoice.partner.district, invoice.partner.city]
                .filter(Boolean).join('، ') || '—'}
            </div>
          </Card>
        </div>

        <Card title="السطور" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>البيان</th>
                  <th className="num" style={{ width: 90 }}>الكمية</th>
                  <th className="num" style={{ width: 120 }}>السعر</th>
                  <th className="num" style={{ width: 110 }}>الخصم</th>
                  <th className="num" style={{ width: 120 }}>الوعاء</th>
                  <th style={{ width: 90 }}>الضريبة</th>
                  <th className="num" style={{ width: 110 }}>قيمتها</th>
                  <th className="num" style={{ width: 130 }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l, i) => (
                  <tr key={l.id}>
                    <td className="num">{i + 1}</td>
                    <td>{l.descAr}</td>
                    <td className="num"><Qty value={l.qty} /> <span className="muted small">{l.uomCode}</span></td>
                    <td className="num"><Money value={l.unitPrice} /></td>
                    <td className="num"><Money value={l.discount} /></td>
                    <td className="num"><Money value={l.lineNet} /></td>
                    <td className="small">
                      <span className="mono">{l.taxCode?.code ?? '—'}</span>
                      <div className="muted">{(Number(l.taxRate) * 100).toFixed(0)}٪</div>
                    </td>
                    <td className="num"><Money value={l.lineVat} /></td>
                    <td className="num"><Money value={l.lineTotal} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>الإجمالي قبل الضريبة</td>
                  <td className="num" colSpan={3}><Money value={invoice.taxableAmount} /></td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5}>ضريبة القيمة المضافة</td>
                  <td className="num" colSpan={3}><Money value={invoice.vatTotal} /></td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5}>الإجمالي شامل الضريبة</td>
                  <td className="num" colSpan={4}><Money value={invoice.total} currency="ر.س" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {invoice.allocations.length > 0 ? (
          <Card title="السداد" flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>السند</th><th>التاريخ</th><th className="num">المبلغ</th></tr>
                </thead>
                <tbody>
                  {invoice.allocations.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.payment.number}</td>
                      <td><DateText value={a.payment.paymentDate} /></td>
                      <td className="num"><Money value={a.amount} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>المسدَّد</td>
                    <td className="num"><Money value={invoice.paidAmount} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ) : null}

        {invoice.zatca ? (
          <Card title="أثر الفاتورة لدى هيئة الزكاة والضريبة" flush>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <td style={{ width: 220 }}>الحالة</td>
                    <td><Status value={invoice.zatca.status} /></td>
                  </tr>
                  <tr>
                    <td>المسار</td>
                    <td>{invoice.zatca.mode === 'CLEARANCE' ? 'إجازة (قبل التسليم)' : 'إبلاغ (خلال ٢٤ ساعة)'}</td>
                  </tr>
                  <tr><td>عدّاد الفاتورة في السلسلة</td><td className="mono">{invoice.zatca.icv}</td></tr>
                  <tr>
                    <td>المعرّف الفريد</td>
                    <td className="mono small">{invoice.zatca.uuid}</td>
                  </tr>
                  <tr>
                    <td>تجزئة الفاتورة</td>
                    <td className="mono small" style={{ wordBreak: 'break-all' }}>{invoice.zatca.hash}</td>
                  </tr>
                  <tr>
                    <td>تجزئة الفاتورة السابقة</td>
                    <td className="mono small" style={{ wordBreak: 'break-all' }}>{invoice.zatca.pih}</td>
                  </tr>
                  <tr>
                    <td>محاولات الإرسال</td>
                    <td className="num">{invoice.zatca.attempts}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}

async function TenantParty({ tenantId }: { tenantId: string }) {
  const t = await withTenant(tenantId, (tx) =>
    tx.tenant.findFirstOrThrow({ where: { id: tenantId } }),
  );
  return (
    <>
      <div style={{ fontWeight: 600 }}>{t.nameAr}</div>
      <div className="small muted">
        الرقم الضريبي <span className="mono">{t.vatNumber ?? '—'}</span>
        {t.crNumber ? <> · السجل <span className="mono">{t.crNumber}</span></> : null}
      </div>
      <div className="small muted">
        {[t.street, t.district, t.city].filter(Boolean).join('، ') || '—'}
      </div>
    </>
  );
}
