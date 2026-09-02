import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { DEFAULT_GOSI_RATES } from '@/lib/hr/gosi.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Alert } from '@/components/ui.tsx';

export default async function SettingsPage() {
  const session = await requireAuth('admin.settings.write');

  const { tenant, taxCodes } = await withTenant(session.tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow({ where: { id: session.tenantId } });
    const taxCodes = await tx.taxCode.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { code: 'asc' },
    });
    return { tenant, taxCodes };
  });

  const missing = [
    !tenant.vatNumber && 'الرقم الضريبي',
    !tenant.crNumber && 'السجل التجاري',
    !tenant.street && 'الشارع',
    !tenant.buildingNo && 'رقم المبنى',
    !tenant.district && 'الحي',
    !tenant.city && 'المدينة',
    !tenant.postalCode && 'الرمز البريدي',
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHead title="إعدادات المنشأة" sub={tenant.nameAr} />

      <div className="content">
        {missing.length > 0 ? (
          <Alert kind="warn" title="بيانات ناقصة تمنع الفوترة الإلكترونية">
            هيئة الزكاة والضريبة تشترط العنوان الوطني كاملاً في الفاتورة.
            الناقص: {missing.join('، ')}.
          </Alert>
        ) : null}

        <Card title="بيانات المنشأة">
          <table>
            <tbody>
              <tr><td style={{ width: 220 }}>الاسم العربي</td><td>{tenant.nameAr}</td></tr>
              <tr><td>الاسم الإنجليزي</td><td>{tenant.nameEn ?? '—'}</td></tr>
              <tr><td>السجل التجاري</td><td className="mono">{tenant.crNumber ?? '—'}</td></tr>
              <tr><td>الرقم الضريبي</td><td className="mono">{tenant.vatNumber ?? '—'}</td></tr>
              <tr><td>الرقم الموحّد</td><td className="mono">{tenant.unifiedNumber ?? '—'}</td></tr>
              <tr>
                <td>العنوان الوطني</td>
                <td>
                  {[tenant.buildingNo, tenant.street, tenant.district, tenant.city, tenant.postalCode]
                    .filter(Boolean).join('، ') || '—'}
                </td>
              </tr>
              <tr><td>عملة الدفاتر</td><td className="mono">{tenant.baseCurrency}</td></tr>
              <tr>
                <td>بداية السنة المالية</td>
                <td>الشهر {tenant.fiscalYearStartMonth}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="الرموز الضريبية" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>الرمز</th>
                  <th>الاسم</th>
                  <th className="num" style={{ width: 90 }}>النسبة</th>
                  <th style={{ width: 150 }}>النوع</th>
                  <th style={{ width: 90 }}>فئة زاتكا</th>
                  <th>سبب الإعفاء</th>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.code}</td>
                    <td>
                      {t.nameAr}
                      {t.isDefault ? <span className="badge info" style={{ marginInlineStart: 6 }}>افتراضي</span> : null}
                    </td>
                    <td className="num">{(Number(t.rate) * 100).toFixed(0)}٪</td>
                    <td className="small">{t.kind}</td>
                    <td className="mono">{t.zatcaCategory}</td>
                    <td className="small muted">
                      {t.exemptionReasonAr ?? '—'}
                      {t.exemptionReasonCode ? <div className="mono">{t.exemptionReasonCode}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="نسب التأمينات الاجتماعية"
          hint="معطياتٌ لا ثوابت في الكود — لأنها تتغيّر بقرار تنظيمي. راجِعها مع مستشارك قبل أول مسيّر."
        >
          <table>
            <tbody>
              <tr><td style={{ width: 300 }}>سارية من</td><td className="num">{DEFAULT_GOSI_RATES.effectiveFrom}</td></tr>
              <tr><td>المعاش — حصة الموظف السعودي</td><td className="num">{(DEFAULT_GOSI_RATES.saudi.pensionEmployee * 100).toFixed(2)}٪</td></tr>
              <tr><td>المعاش — حصة صاحب العمل</td><td className="num">{(DEFAULT_GOSI_RATES.saudi.pensionEmployer * 100).toFixed(2)}٪</td></tr>
              <tr><td>ساند — حصة الموظف</td><td className="num">{(DEFAULT_GOSI_RATES.saudi.sanedEmployee * 100).toFixed(2)}٪</td></tr>
              <tr><td>ساند — حصة صاحب العمل</td><td className="num">{(DEFAULT_GOSI_RATES.saudi.sanedEmployer * 100).toFixed(2)}٪</td></tr>
              <tr><td>الأخطار المهنية (صاحب العمل)</td><td className="num">{(DEFAULT_GOSI_RATES.saudi.occupationalHazards * 100).toFixed(2)}٪</td></tr>
              <tr><td>غير السعودي — الأخطار المهنية فقط</td><td className="num">{(DEFAULT_GOSI_RATES.nonSaudi.occupationalHazards * 100).toFixed(2)}٪</td></tr>
              <tr><td>الحدّ الأدنى لوعاء الاشتراك</td><td className="num">{DEFAULT_GOSI_RATES.minBase.toLocaleString('en')}</td></tr>
              <tr><td>الحدّ الأعلى لوعاء الاشتراك</td><td className="num">{DEFAULT_GOSI_RATES.maxBase.toLocaleString('en')}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
