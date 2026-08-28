import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { projectsOverview } from '@/lib/projects/projects.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Pct, Qty, Status, Empty, Kpi } from '@/components/ui.tsx';
import { Decimal } from '@/lib/money.ts';

export default async function ProjectsPage() {
  const session = await requireAuth('projects.project.read');

  const rows = await withTenant(session.tenantId, (tx) =>
    projectsOverview(tx, session.tenantId),
  );

  const totalRevenue = rows.reduce((s, r) => s.plus(r.revenue), new Decimal(0));
  const totalProfit = rows.reduce((s, r) => s.plus(r.grossProfit), new Decimal(0));
  const totalUnbilled = rows.reduce((s, r) => s.plus(r.unbilledValue), new Decimal(0));
  const overBudget = rows.filter((r) => r.overBudget).length;

  return (
    <>
      <PageHead title="المشاريع" sub={`${rows.length} مشروعاً`} />

      <div className="content">
        <div className="kpis">
          <Kpi label="إيراد المشاريع" value={<Money value={totalRevenue} currency="ر.س" />} />
          <Kpi
            label="مجمل الربح"
            value={<Money value={totalProfit} currency="ر.س" />}
            tone={totalProfit.isNegative() ? 'bad' : 'good'}
          />
          <Kpi
            label="ساعات لم تُفوتر"
            value={<Money value={totalUnbilled} currency="ر.س" />}
            note="إيرادٌ مستحقّ لم يُطالَب به"
            tone={totalUnbilled.greaterThan(0) ? 'bad' : undefined}
          />
          <Kpi
            label="تجاوزت ميزانيتها"
            value={overBudget}
            tone={overBudget > 0 ? 'bad' : undefined}
          />
        </div>

        <Card
          hint="الإيراد والتكلفة من دفتر الأستاذ لا من الفواتير — فتدخل فيهما التسويات والقيود الموزَّعة على المشاريع."
          flush
        >
          {rows.length === 0 ? (
            <Empty title="لا مشاريع" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>الرمز</th>
                    <th>المشروع</th>
                    <th>العميل</th>
                    <th style={{ width: 100 }}>الحالة</th>
                    <th className="num" style={{ width: 70 }}>مهام مفتوحة</th>
                    <th className="num" style={{ width: 80 }}>الساعات</th>
                    <th className="num" style={{ width: 130 }}>الإيراد</th>
                    <th className="num" style={{ width: 130 }}>التكلفة</th>
                    <th className="num" style={{ width: 130 }}>مجمل الربح</th>
                    <th className="num" style={{ width: 80 }}>الهامش</th>
                    <th className="num" style={{ width: 130 }}>لم يُفوتر</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.code}</td>
                      <td>
                        <Link href={`/projects/${p.id}`}>{p.nameAr}</Link>
                        {p.overBudget
                          ? <div><span className="badge bad">تجاوز الميزانية</span></div>
                          : null}
                      </td>
                      <td className="small">{p.partnerAr ?? <span className="muted">—</span>}</td>
                      <td><Status value={p.status} /></td>
                      <td className="num">{p.openTasks || '—'}</td>
                      <td className="num"><Qty value={p.totalHours} dp={1} /></td>
                      <td className="num"><Money value={p.revenue} /></td>
                      <td className="num"><Money value={p.directCost} /></td>
                      <td className="num">
                        <span className={p.grossProfit.isNegative() ? 'neg' : 'pos'}>
                          <Money value={p.grossProfit} />
                        </span>
                      </td>
                      <td className="num"><Pct value={p.margin} /></td>
                      <td className="num">
                        {p.unbilledValue.isZero()
                          ? <span className="muted">—</span>
                          : <span className="badge warn"><Money value={p.unbilledValue} /></span>}
                      </td>
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
