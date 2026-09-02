import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Money, Kpi } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { assetRegister } from '@/lib/assets/depreciation.ts';
import { NewAssetForm, DisposeAsset } from './asset-forms.tsx';

const METHOD_AR: Record<string, string> = {
  STRAIGHT_LINE: 'القسط الثابت',
  DECLINING_BALANCE: 'المتناقص',
  UNITS_OF_PRODUCTION: 'وحدات الإنتاج',
};

export default async function AssetsPage() {
  const session = await requireAuth('assets.asset.read');
  const editable = can(session.permissions, 'assets.asset.write');
  const disposable = can(session.permissions, 'assets.asset.dispose');

  const { register, bankAccounts } = await withTenant(session.tenantId, async (tx) => ({
    register: await assetRegister(tx, session.tenantId),
    bankAccounts: await tx.account.findMany({
      where: { tenantId: session.tenantId, subtype: { in: ['BANK', 'CASH'] }, isGroup: false },
      select: { id: true, code: true, nameAr: true },
      orderBy: { code: 'asc' },
    }),
  }));

  return (
    <>
      <PageHead
        title="سجل الأصول الثابتة"
        sub="التكلفة التاريخية تبقى ظاهرة، والمجمَّع ينقص القيمة دون أن يمسّها."
      />

      <div className="content">
        <div className="kpis">
          <Kpi label="التكلفة" value={<Money value={register.totalCost} />} note="الأصول القائمة" />
          <Kpi label="مجمَّع الاستهلاك" value={<Money value={register.totalAccumulated} />} />
          <Kpi
            label="القيمة الدفترية"
            value={<Money value={register.totalBookValue} />}
            note="التكلفة ناقصاً المجمَّع"
          />
          <Kpi label="عدد الأصول" value={register.rows.filter((r) => r.active).length} />
        </div>

        {editable ? <NewAssetForm /> : null}

        <Card title="الأصول" hint={`${register.rows.length} أصلاً في السجل`} flush>
          {register.rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty
                title="لا أصول بعد"
                hint="أضِف أصلاً لتبدأ جدولة استهلاكه شهرياً."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الأصل</th>
                    <th style={{ width: 120 }}>الفئة</th>
                    <th style={{ width: 110 }}>طريقة الاستهلاك</th>
                    <th style={{ width: 100 }}>بدء التشغيل</th>
                    <th className="num" style={{ width: 70 }}>العمر (شهر)</th>
                    <th className="num" style={{ width: 120 }}>التكلفة</th>
                    <th className="num" style={{ width: 120 }}>المجمَّع</th>
                    <th className="num" style={{ width: 120 }}>القيمة الدفترية</th>
                    <th className="num" style={{ width: 70 }}>المستهلَك</th>
                    <th style={{ width: 120 }}>الحالة</th>
                    {disposable ? <th style={{ width: 90 }} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {register.rows.map((a) => (
                    <tr key={a.id}>
                      <td className="num mono">{a.code}</td>
                      <td>{a.nameAr}</td>
                      <td className="muted">{a.categoryAr ?? '—'}</td>
                      <td className="small">{METHOD_AR[a.method] ?? a.method}</td>
                      <td><DateText value={a.inServiceDate} /></td>
                      <td className="num">{a.usefulLifeMonths}</td>
                      <td className="num"><Money value={a.cost} /></td>
                      <td className="num"><Money value={a.accumulated} /></td>
                      <td className="num"><Money value={a.bookValue} /></td>
                      <td className="num">
                        {a.depreciatedPercent ? `${a.depreciatedPercent.toFixed(1)}٪` : '—'}
                      </td>
                      <td><Status value={a.status} /></td>
                      {disposable ? (
                        <td>
                          {a.active ? (
                            <DisposeAsset
                              assetId={a.id}
                              nameAr={a.nameAr}
                              bookValue={a.bookValue.toFixed(2)}
                              accounts={bankAccounts}
                            />
                          ) : null}
                        </td>
                      ) : null}
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
