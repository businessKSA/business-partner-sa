import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Money, Kpi, Alert } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { previewRevaluation, currencyExposure } from '@/lib/accounting/fx.ts';
import { money, Decimal } from '@/lib/money.ts';
import { RateForm, RevalueForm } from './fx-actions.tsx';

export default async function FxPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const session = await requireAuth('accounting.report.read');
  const canWriteRates = can(session.permissions, 'accounting.fx.write');
  const canRevalue = can(session.permissions, 'accounting.fx.revalue');

  const { asOf: asOfRaw } = await searchParams;
  const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
  const asOfIso = asOf.toISOString().slice(0, 10);

  const data = await withTenant(session.tenantId, async (tx) => ({
    preview: await previewRevaluation(tx, session.tenantId, asOf),
    exposure: await currencyExposure(tx, session.tenantId, asOf),
    rates: await tx.exchangeRate.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ date: 'desc' }, { currency: 'asc' }],
      take: 40,
    }),
    revaluations: await tx.fxRevaluation.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { valuationDate: 'desc' },
      take: 12,
    }),
  }));

  const { preview, exposure, rates, revaluations } = data;
  const totalBookValue = money(
    exposure.currencies.reduce((s, c) => s.plus(c.bookValue), new Decimal(0)),
  );

  return (
    <>
      <PageHead
        title="العملات وفروق التقييم"
        sub={`عملة الدفاتر ${exposure.baseCurrency}. الفرق غير المحقَّق يُثبَت ليظهر في القوائم ثم يُرفع في اليوم التالي.`}
        actions={
          <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" name="asOf" defaultValue={asOfIso} />
            <button className="btn sm" type="submit">عرض</button>
          </form>
        }
      />

      <div className="content">
        <div className="kpis">
          <Kpi label="عملات لها أرصدة" value={exposure.currencies.length} />
          <Kpi
            label="القيمة الدفترية"
            value={<Money value={totalBookValue} />}
            note={`بـ${exposure.baseCurrency}`}
          />
          <Kpi
            label="صافي الانكشاف"
            value={<Money value={exposure.netExposure} colored />}
            tone={exposure.netExposure.greaterThanOrEqualTo(0) ? 'good' : 'bad'}
            note="الفرق لو أُعيد التقييم اليوم"
          />
          <Kpi label="حسابات تحتاج تقييماً" value={preview.lines.length} />
        </div>

        {canWriteRates ? <RateForm defaultDate={asOfIso} /> : null}

        <Card
          title="الانكشاف بالعملات"
          hint={`كما في ${asOfIso}`}
          flush
        >
          {exposure.currencies.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty
                title="لا أرصدة بعملات أجنبية"
                hint="عيّن عملةً لحسابٍ في شجرة الحسابات ليدخل التقييم."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>العملة</th>
                    <th className="num" style={{ width: 150 }}>الرصيد بالعملة</th>
                    <th className="num" style={{ width: 150 }}>القيمة الدفترية</th>
                    <th className="num" style={{ width: 150 }}>القيمة الحالية</th>
                    <th className="num" style={{ width: 150 }}>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {exposure.currencies.map((c) => (
                    <tr key={c.currency}>
                      <td className="mono"><strong>{c.currency}</strong></td>
                      <td className="num"><Money value={c.foreignBalance} currency={c.currency} /></td>
                      <td className="num"><Money value={c.bookValue} /></td>
                      <td className="num"><Money value={c.currentValue} /></td>
                      <td className="num"><Money value={c.exposure} colored /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {preview.lines.length > 0 ? (
          <Card
            title="معاينة إعادة التقييم"
            hint="الحسابات التي تغيّرت قيمتها بالعملة الأساسية"
            actions={canRevalue ? <RevalueForm defaultDate={asOfIso} /> : null}
            flush
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الحساب</th>
                    <th style={{ width: 70 }}>العملة</th>
                    <th className="num" style={{ width: 140 }}>الرصيد بالعملة</th>
                    <th className="num" style={{ width: 110 }}>السعر</th>
                    <th className="num" style={{ width: 140 }}>الدفترية</th>
                    <th className="num" style={{ width: 140 }}>بعد التقييم</th>
                    <th className="num" style={{ width: 140 }}>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l) => (
                    <tr key={l.accountId}>
                      <td className="num mono">{l.code}</td>
                      <td>{l.nameAr}</td>
                      <td className="mono">{l.currency}</td>
                      <td className="num"><Money value={l.foreignBalance} currency={l.currency} /></td>
                      <td className="num mono">{l.rate.toFixed(4)}</td>
                      <td className="num"><Money value={l.bookValue} /></td>
                      <td className="num"><Money value={l.revaluedValue} /></td>
                      <td className="num"><Money value={l.difference} colored /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7}><strong>صافي الفرق</strong></td>
                    <td className="num">
                      <strong><Money value={preview.netDifference} colored /></strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ) : (
          <Alert kind="info" title="لا فروق تحتاج تقييماً في هذا التاريخ">
            إمّا أن الأرصدة الأجنبية صفر، وإمّا أن أسعار اليوم تساوي أسعار التقييد.
          </Alert>
        )}

        <div className="grid-2">
          <Card title="عمليات إعادة التقييم" flush>
            {revaluations.length === 0 ? (
              <div style={{ padding: 16 }}>
                <Empty title="لا عمليات بعد" />
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>الرقم</th>
                      <th style={{ width: 110 }}>التاريخ</th>
                      <th className="num" style={{ width: 60 }}>حسابات</th>
                      <th className="num" style={{ width: 130 }}>صافي الفرق</th>
                      <th style={{ width: 100 }}>العكس</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revaluations.map((r) => (
                      <tr key={r.id}>
                        <td className="mono small">{r.number}</td>
                        <td><DateText value={r.valuationDate} /></td>
                        <td className="num">{r.accountCount}</td>
                        <td className="num"><Money value={r.netDifference} colored /></td>
                        <td>
                          {r.reversalEntryId ? (
                            <Status value="REVERSED" />
                          ) : (
                            <span className="small muted">بلا عكس</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="أسعار الصرف" hint="آخر ٤٠ سعراً" flush>
            {rates.length === 0 ? (
              <div style={{ padding: 16 }}>
                <Empty title="لا أسعار" hint="أدخِل سعراً ليُقيَّم الرصيد الأجنبي." />
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>العملة</th>
                      <th style={{ width: 110 }}>التاريخ</th>
                      <th className="num">السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id}>
                        <td className="mono"><strong>{r.currency}</strong></td>
                        <td><DateText value={r.date} /></td>
                        <td className="num mono">{Number(r.rate).toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
