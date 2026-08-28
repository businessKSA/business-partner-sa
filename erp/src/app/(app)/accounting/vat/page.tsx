import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { vatReturn } from '@/lib/accounting/vat.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Kpi, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { DateRange } from '../date-range.tsx';

export default async function VatPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await requireAuth('accounting.vat.read');
  const sp = await searchParams;

  const now = new Date();
  // الافتراضي: الربع الحالي — وهي دورة الإقرار لأغلب المنشآت
  const quarter = Math.floor(now.getUTCMonth() / 3);
  const from = sp.from ? new Date(sp.from) : new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
  const to = sp.to ? new Date(sp.to) : new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 0));

  const vat = await withTenant(session.tenantId, (tx) =>
    vatReturn(tx, session.tenantId, from, to),
  );

  return (
    <>
      <PageHead
        title="إقرار ضريبة القيمة المضافة"
        sub={`${from.toISOString().slice(0, 10)} — ${to.toISOString().slice(0, 10)}`}
        actions={<PrintButton />}
      />

      <div className="content">
        <DateRange from={from} to={to} basePath="/accounting/vat" />

        <Alert kind="info">
          هذه الأرقام مُجهَّزة من دفتر الأستاذ لتُنقل إلى إقرارك لدى الهيئة.
          <strong style={{ display: 'inline' }}> </strong>
          التقديم فعلٌ بشري مسؤول — النظام لا يقدّم نيابةً عن المكلَّف.
        </Alert>

        <div className="kpis">
          <Kpi label="ضريبة المخرجات" value={<Money value={vat.outputVat} currency="ر.س" />} />
          <Kpi label="ضريبة المدخلات" value={<Money value={vat.inputVat} currency="ر.س" />} />
          <Kpi
            label={vat.netVat.isNegative() ? 'رصيد دائن يُرحَّل أو يُسترد' : 'المستحقّ للهيئة'}
            value={<Money value={vat.netVat.abs()} currency="ر.س" />}
            tone={vat.netVat.isNegative() ? 'good' : undefined}
          />
        </div>

        <div className="grid-2">
          <Card title="المبيعات" flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>البند</th><th className="num">الوعاء</th><th className="num">الضريبة</th></tr>
                </thead>
                <tbody>
                  {vat.salesBoxes.map((b) => (
                    <tr key={b.key}>
                      <td>{b.labelAr}</td>
                      <td className="num"><Money value={b.amount} /></td>
                      <td className="num"><Money value={b.vat} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>إجمالي المبيعات</td>
                    <td className="num"><Money value={vat.totalSales} /></td>
                    <td className="num"><Money value={vat.outputVat} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="المشتريات" flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>البند</th><th className="num">الوعاء</th><th className="num">الضريبة</th></tr>
                </thead>
                <tbody>
                  {vat.purchaseBoxes.map((b) => (
                    <tr key={b.key}>
                      <td>{b.labelAr}</td>
                      <td className="num"><Money value={b.amount} /></td>
                      <td className="num"><Money value={b.vat} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>إجمالي المشتريات</td>
                    <td className="num"><Money value={vat.totalPurchases} /></td>
                    <td className="num"><Money value={vat.inputVat} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <Card title="صافي الضريبة">
          <table>
            <tbody>
              <tr>
                <td>ضريبة المخرجات على المبيعات</td>
                <td className="num"><Money value={vat.outputVat} /></td>
              </tr>
              <tr>
                <td>ناقصاً: ضريبة المدخلات القابلة للخصم</td>
                <td className="num">− <Money value={vat.inputVat} /></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>{vat.netVat.isNegative() ? 'رصيد دائن' : 'صافي الضريبة المستحقة'}</td>
                <td className="num"><Money value={vat.netVat.abs()} currency="ر.س" /></td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </>
  );
}
